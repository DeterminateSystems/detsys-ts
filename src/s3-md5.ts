import { stringifyError } from "./errors.js";
import * as actionsCore from "@actions/core";
import { createHash } from "node:crypto";
import { PathLike } from "node:fs";
import { FileHandle, open } from "node:fs/promises";

// eslint has a thing against enums:
// https://github.com/typescript-eslint/typescript-eslint/blob/ee347494cb76a9b145283102e7814808e240201e/packages/eslint-plugin/docs/rules/no-shadow.mdx#why-does-the-rule-report-on-enum-members-that-share-the-same-name-as-a-variable-in-a-parent-scope
// eslint-disable-next-line no-shadow
export enum EtagStatus {
  Valid = "valid",
  Corrupt = "corrupt",
}

export interface AwsS3Etag {
  hash: string;
  chunks: number | undefined;
}

export function parseEtag(etag: string): AwsS3Etag | undefined {
  if (!etag.includes("-")) {
    return {
      hash: etag,
      chunks: undefined,
    };
  }

  const parts = etag.split("-", 2);
  if (parts.length !== 2) {
    actionsCore.debug(
      `Parsing etag ${etag} failed: expected 2 parts but got ${parts.length}`,
    );
    return undefined;
  }

  const chunks = parseInt(parts[1], 10);
  if (isNaN(chunks)) {
    actionsCore.debug(`Parsing etag ${etag} failed: ${parts[1]} is NaN`);
    return undefined;
  }

  return {
    hash: parts[0],
    chunks,
  };
}

export function cleanEtag(inputEtag: string): string {
  let etag = inputEtag;
  if (etag.startsWith("W/")) {
    etag = etag.substring(2);
  }

  if (etag.startsWith('"') && etag.endsWith('"')) {
    etag = etag.substring(1, etag.length - 1);
  }

  return etag;
}

export async function verifyEtag(
  filename: PathLike,
  quotedExpectedEtag: string,
): Promise<EtagStatus> {
  try {
    const expectedEtag = cleanEtag(quotedExpectedEtag);
    const parsedEtag = parseEtag(expectedEtag);
    if (parsedEtag === undefined) {
      actionsCore.info(
        `Verifying etag failed: etag did not parse: ${expectedEtag}`,
      );
      return EtagStatus.Corrupt;
    }

    const fd = await open(filename, "r");

    let actualEtag: string;
    if (parsedEtag.chunks === undefined) {
      actionsCore.debug(`Verifying etag with a simple md5`);
      actualEtag = await calculateMd5Etag(fd);
    } else {
      actionsCore.debug(`Verifying etag with a chunked md5 from s3`);
      actualEtag = await calculateS3ChunkedEtag(fd, parsedEtag.chunks);
    }

    await fd.close();

    if (expectedEtag === actualEtag) {
      return EtagStatus.Valid;
    } else {
      actionsCore.info(
        `Verifying etag failed: etag mismatch. Wanted ${expectedEtag}, got ${actualEtag}`,
      );
      return EtagStatus.Corrupt;
    }
  } catch (e: unknown) {
    actionsCore.debug(`Verifying etag failed: ${stringifyError(e)}`);
    return EtagStatus.Corrupt;
  }
}

export async function calculateMd5Etag(fd: FileHandle): Promise<string> {
  const fileHash = createHash("md5");

  const buf = Buffer.alloc(1024 * 1024);
  let bytesRead: number;
  while ((({ bytesRead } = await fd.read(buf)), bytesRead > 0)) {
    fileHash.update(buf.subarray(0, bytesRead));
  }

  return fileHash.digest("hex");
}

export async function calculateS3ChunkedEtag(
  fd: FileHandle,
  chunks: number,
): Promise<string> {
  const stat = await fd.stat();

  const chunkSizeBytes =
    Math.ceil(stat.size / (1024 * 1024) / chunks) * 1024 * 1024;

  const overallHash = createHash("md5");

  const buf = Buffer.alloc(chunkSizeBytes);
  let bytesRead: number;
  let blockCount = 0;
  while ((({ bytesRead } = await fd.read(buf)), bytesRead > 0)) {
    blockCount += 1;
    const chunkHash = createHash("md5");
    chunkHash.update(buf.subarray(0, bytesRead));

    overallHash.update(chunkHash.digest());
  }

  return `${overallHash.digest("hex")}-${blockCount}`;
}

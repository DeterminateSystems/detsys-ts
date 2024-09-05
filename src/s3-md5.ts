import { stringifyError } from "./errors.js";
import * as actionsCore from "@actions/core";
import { createHash } from "node:crypto";
import { PathLike } from "node:fs";
import { FileHandle, open } from "node:fs/promises";

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

export async function verifyEtag(
  filename: PathLike,
  expectedEtag: string,
): Promise<"valid" | "corrupt"> {
  try {
    const parsedEtag = parseEtag(expectedEtag);
    if (parsedEtag === undefined) {
      actionsCore.info(
        `Verifying etag failed: etag did not parse: ${expectedEtag}`,
      );
      return "corrupt";
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
      return "valid";
    } else {
      actionsCore.info(
        `Verifying etag failed: etag mismatch. Wanted ${expectedEtag}, got ${actualEtag}`,
      );
      return "corrupt";
    }
  } catch (e: unknown) {
    actionsCore.debug(`Verifying etag failed: ${stringifyError(e)}`);
    return "corrupt";
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

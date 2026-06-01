/**
 * @packageDocumentation
 * Parsing and hashing helpers for `shasum`-format checksum files, used to
 * hash-lock downloaded artifacts.
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

const HEX_STRING_RE = /^[0-9a-fA-F]+$/;

/**
 * Parse a `shasum`-format checksums file into a map of filename -> hex digest.
 *
 * Each non-empty line has the shape `<hex-digest><space(s)><filename>`. Lines
 * without a space delimiter are skipped. Invalid hex digests throw, so a
 * malformed file fails loudly rather than silently skipping the entry we
 * care about.
 */
export function parseChecksumsFile(text: string): Map<string, string> {
  const result = new Map<string, string>();

  for (const record of text.split(/\r\n|\n|\r/).filter(Boolean)) {
    const delimIndex = record.indexOf(" ");
    if (delimIndex === -1) {
      continue;
    }

    const digest = record.slice(0, delimIndex);
    if (!HEX_STRING_RE.test(digest)) {
      throw new Error(`Invalid digest in checksums file: ${digest}`);
    }

    const name = record.slice(delimIndex + 1).trim();
    if (name === "") {
      continue;
    }

    result.set(name, digest.toLowerCase());
  }

  return result;
}

/**
 * Compute the SHA-256 of a file on disk and return its lowercase hex digest.
 * Streams the file so memory use is constant regardless of size.
 */
export async function sha256OfFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256").setEncoding("hex");
    createReadStream(filePath)
      .once("error", reject)
      .pipe(hash)
      .once("finish", () => resolve(hash.read() as string));
  });
}

/**
 * Compute the SHA-256 of an in-memory buffer or string and return its
 * lowercase hex digest.
 */
export function sha256OfBuffer(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

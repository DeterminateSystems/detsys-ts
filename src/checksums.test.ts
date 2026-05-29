import { parseChecksumsFile, sha256OfBuffer } from "./checksums.js";
import * as os from "node:os";
import { describe, expect, test } from "vitest";

describe("parseChecksumsFile", () => {
  test("parses a typical shasum-format file", () => {
    const text = [
      "4a215517d0bcb37c47b9178e2668d7651a7fef9a482cef482227ad09796cdfc0  nix-installer-x86_64-linux",
      "baaf26b33519fe4494729aab9b02cea449a134ed028b5c21d16ca42734da76e4  nix-installer-aarch64-linux",
      "154ea883ce098eac4fa106ff9ee4e4964bb97f809dd8ec9c34a432b466ce1494  nix-installer-aarch64-darwin",
    ].join(os.EOL);

    const result = parseChecksumsFile(text);
    expect(result.get("nix-installer-x86_64-linux")).toBe(
      "4a215517d0bcb37c47b9178e2668d7651a7fef9a482cef482227ad09796cdfc0",
    );
    expect(result.get("nix-installer-aarch64-darwin")).toBe(
      "154ea883ce098eac4fa106ff9ee4e4964bb97f809dd8ec9c34a432b466ce1494",
    );
    expect(result.size).toBe(3);
  });

  test("ignores blank lines", () => {
    const text = [
      "",
      "4a215517d0bcb37c47b9178e2668d7651a7fef9a482cef482227ad09796cdfc0  nix-installer-x86_64-linux",
      "",
    ].join(os.EOL);
    const result = parseChecksumsFile(text);
    expect(result.size).toBe(1);
  });

  test("skips lines without a space delimiter", () => {
    const text = [
      "noseparatorhere",
      "4a215517d0bcb37c47b9178e2668d7651a7fef9a482cef482227ad09796cdfc0  nix-installer-x86_64-linux",
    ].join(os.EOL);
    const result = parseChecksumsFile(text);
    expect(result.size).toBe(1);
    expect(result.has("nix-installer-x86_64-linux")).toBe(true);
  });

  test("throws on a non-hex digest", () => {
    const text =
      "not_a_valid_hex_digest_with_underscores_in_it_at_64_long_xxxxxxxxx  nix-installer-x86_64-linux";
    expect(() => parseChecksumsFile(text)).toThrow(
      /Invalid digest in checksums file/,
    );
  });

  test("uppercase hex digests are normalised to lowercase", () => {
    const text =
      "4A215517D0BCB37C47B9178E2668D7651A7FEF9A482CEF482227AD09796CDFC0  nix-installer-x86_64-linux";
    const result = parseChecksumsFile(text);
    expect(result.get("nix-installer-x86_64-linux")).toBe(
      "4a215517d0bcb37c47b9178e2668d7651a7fef9a482cef482227ad09796cdfc0",
    );
  });

  test("empty filename is skipped", () => {
    const text = `4a215517d0bcb37c47b9178e2668d7651a7fef9a482cef482227ad09796cdfc0   `;
    const result = parseChecksumsFile(text);
    expect(result.size).toBe(0);
  });
});

describe("sha256OfBuffer", () => {
  test("matches a known vector", () => {
    expect(sha256OfBuffer("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(sha256OfBuffer("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

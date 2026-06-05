import { assertChecksumSourceIsPinned } from "./sourcedef.js";
import { describe, expect, test } from "vitest";

describe("assertChecksumSourceIsPinned", () => {
  test.each([
    ["tag", { tag: "v1.2.3" }],
    ["revision", { revision: "abc123" }],
    ["url", { url: "https://example.com/artifact" }],
  ])("allows a source pinned by %s", (_name, source) => {
    expect(() => assertChecksumSourceIsPinned(source)).not.toThrow();
  });

  test.each([
    ["no selector (stable fallback)", {}],
    ["branch", { branch: "main" }],
    ["pr", { pr: "123" }],
  ])("throws for a moving source: %s", (_name, source) => {
    expect(() => assertChecksumSourceIsPinned(source)).toThrow(
      /requires a pinned source/,
    );
  });
});

import {
  AwsS3Etag,
  calculateMd5Etag,
  calculateS3ChunkedEtag,
  parseEtag,
  verifyEtag,
} from "./s3-md5.js";
import { open } from "node:fs/promises";
import { describe, expect, it, test } from "vitest";

describe("verifyEtag", async () => {
  type TestCase = {
    text: string;
    etag: string;
    expected: "valid" | "corrupt";
  };

  const testCases: TestCase[] = [
    {
      text: "one,two,thr333ee",
      etag: "3f87fa5a68c3d80fe5bfa86e17aad32e",
      expected: "valid",
    },
    {
      text: "one,two,thr333ee",
      etag: "4f87fa5a68c3d80fe5bfa86e17aad32b",
      expected: "corrupt",
    },
    {
      text: "one,two,thr333ee",
      etag: "375b00d80a3b50548658edac27dafeb6-1",
      expected: "valid",
    },
    {
      text: "one,two,thr333ee",
      etag: "4f87fa5a68c3d80fe5bfa86e17aad32b-1",
      expected: "corrupt",
    },
  ];

  const file = await open("/tmp/etag-validate", "w+");

  for (const { text, etag, expected } of testCases) {
    test(`Validating ${etag}, expecting ${expected}`, async () => {
      await file.truncate();
      await file.write(text, 0);
      await file.sync();

      expect(await verifyEtag("/tmp/etag-validate", etag)).toStrictEqual(
        expected,
      );
    });
  }
});

describe("parseEtag", () => {
  type TestCase = {
    input: string;
    expected: AwsS3Etag | undefined;
  };

  const testCases: TestCase[] = [
    {
      input: "one,two,three",
      expected: {
        hash: "one,two,three",
        chunks: undefined,
      },
    },
    {
      input: "",
      expected: {
        hash: "",
        chunks: undefined,
      },
    },
    {
      input: "foo-bar-1",
      expected: undefined,
    },
    {
      input: "foo-bar",
      expected: undefined,
    },
    {
      input: "foo-1",
      expected: {
        hash: "foo",
        chunks: 1,
      },
    },
    {
      input: "foo-99",
      expected: {
        hash: "foo",
        chunks: 99,
      },
    },
  ];

  for (const { input, expected } of testCases) {
    test(`Parsing ${JSON.stringify(input)} as an etag ${JSON.stringify(input)}`, () => {
      expect(parseEtag(input)).toStrictEqual(expected);
    });
  }
});

describe("calculateMd5Etag", async () => {
  type TestCase = {
    text: string;
    expected: string;
  };

  const testCases: TestCase[] = [
    // Properly formed strings
    {
      text: "one,two,thr333ee",
      expected: "3f87fa5a68c3d80fe5bfa86e17aad32e",
    },
  ];

  const file = await open("/tmp/md5-chunks", "w+");

  for (const { text, expected } of testCases) {
    test(`Looking for an etag of ${expected}`, async () => {
      await file.truncate();
      await file.write(text, 0);
      await file.write("", 0);

      expect(await calculateMd5Etag(file)).toStrictEqual(expected);
    });
  }
});

describe("calculateS3ChunkedEtag", async () => {
  type TestCase = {
    text: string;
    chunks: number;
    expected: string;
  };

  const testCases: TestCase[] = [
    // Properly formed strings
    {
      text: "one,two,thr333ee",
      chunks: 1,
      expected: "375b00d80a3b50548658edac27dafeb6-1",
    },
  ];

  const file = await open("/tmp/s3-chunks", "w+");

  for (const { text, chunks, expected } of testCases) {
    test(`Looking for an etag of ${expected} in ${chunks} chunks`, async () => {
      await file.truncate();
      await file.write(text, 0);
      await file.write("", 0);

      expect(await calculateS3ChunkedEtag(file, chunks)).toStrictEqual(
        expected,
      );
    });
  }
});

describe("calculateS3ChunkedEtag-localbin", async () => {
  type TestCase = {
    file: string;
    chunks: number;
    expected: string;
  };

  const testCases: TestCase[] = [
    // You can create your own test cases here for spot checking, via:
    //
    //    curl -Lv https://fiids.install.determinate.systems/nix-installer/stable/aarch64-linux --output nix-installer
    //
    // ...and plucking out the etag: ETag: "bf49cee930741b5fa3076455a7f5c2d1-6"

    /*
    {
      file: "...nix-installer",
      chunks: 6,
      expected: "bf49cee930741b5fa3076455a7f5c2d1-6"
    },
    */
    {
      file: "/Users/grahamchristensen/src/github.com/DeterminateSystems/determinate-nixd/aa",
      chunks: 6,
      expected: "bf49cee930741b5fa3076455a7f5c2d1-6",
    },
  ];

  if (testCases.length === 0) {
    it.skip("skipped: none defined", () => {});
  }

  for (const { file, chunks, expected } of testCases) {
    test(`Looking for an etag of ${expected} in ${chunks} chunks`, async () => {
      const fd = await open(file, "r");

      expect(await calculateS3ChunkedEtag(fd, chunks)).toStrictEqual(expected);
    });
  }
});

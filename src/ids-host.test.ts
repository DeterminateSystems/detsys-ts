import {
  IdsHost,
  discoverServicesStub,
  orderRecordsByPriorityWeight,
  recordToUrl,
  weightedRandom,
} from "./ids-host.js";
import { SrvRecord } from "node:dns";
import { assert, describe, expect, test } from "vitest";

function mkRecord(
  weight: number,
  priority = 0,
  suffix = "install.determinate.systems",
): SrvRecord {
  return {
    weight,
    priority,
    port: priority * 100 + weight,
    name: `${priority}.${weight}.${suffix}`,
  };
}

async function mkPromise<T>(lookup: () => T): Promise<T> {
  return lookup();
}

describe("isUrlSubjectToDynamicUrls", () => {
  type TestCase = {
    inputUrl: string;
    inScope: boolean;
  };

  const testCases: TestCase[] = [
    {
      inputUrl: "https://example.com/bar",
      inScope: false,
    },
    {
      inputUrl: "https://install.determinate.systems/aoeu",
      inScope: true,
    },
    {
      inputUrl: "https://install.determinate.systems/",
      inScope: true,
    },
    {
      inputUrl: "https://install.determinate.systems",
      inScope: true,
    },
    {
      inputUrl: "https://install.determinate.systems:123/",
      inScope: false,
    },
    {
      inputUrl: "http://install.determinate.systems/",
      inScope: false,
    },
    {
      inputUrl: "https://install.detsys.dev/",
      inScope: false, // FALSE: only subdomains are valid
    },
    {
      inputUrl: "https://foo.install.detsys.dev/",
      inScope: true,
    },
    {
      inputUrl: "https://foo.install.determinate.systems/",
      inScope: true,
    },
  ];

  for (const { inputUrl, inScope } of testCases) {
    test(`${inputUrl} should ${inScope ? "" : "not "}be subject to dynamic URLs`, async () => {
      const host = new IdsHost("foo", "bar", "-");

      expect(host.isUrlSubjectToDynamicUrls(new URL(inputUrl))).toStrictEqual(
        inScope,
      );
    });
  }
});

describe("getRootUrl", () => {
  test("handles no URLs", async () => {
    const host = new IdsHost("foo", "bar", "-");
    host.setPrioritizedUrls([]);
    expect(await host.getRootUrl()).toStrictEqual(
      new URL("https://install.determinate.systems"),
    );
  });

  test("handles multiple URLs", async () => {
    const host = new IdsHost("foo", "bar", "-");
    host.setPrioritizedUrls(["https://foo/", "https://bar/"]);
    expect(await host.getRootUrl()).toStrictEqual(new URL("https://foo"));
  });

  test("falls back on downed URL", async () => {
    const host = new IdsHost("foo", "bar", "-");
    host.setPrioritizedUrls(["https://foo/", "https://bar/"]);
    expect(await host.getRootUrl()).toStrictEqual(new URL("https://foo"));
    host.markCurrentHostBroken();
    expect(await host.getRootUrl()).toStrictEqual(new URL("https://bar"));
    host.markCurrentHostBroken();
    expect(await host.getRootUrl()).toStrictEqual(
      new URL("https://install.determinate.systems"),
    );
    host.markCurrentHostBroken();
    host.markCurrentHostBroken();
    expect(await host.getRootUrl()).toStrictEqual(
      new URL("https://install.determinate.systems"),
    );
  });
});

describe("getDiagnosticsUrl", () => {
  type TestCase = {
    description: string;
    idsProjectName: string;
    suffix?: string;
    runtimeDiagnosticsUrl?: string;
    expectedUrl?: string;
  };

  const testCases: TestCase[] = [
    {
      description: "User-provided diagnostic URL is preferred",
      idsProjectName: "project-name",
      suffix: "telemetry",
      runtimeDiagnosticsUrl: "https://example.com/bar",
      expectedUrl: "https://example.com/bar",
    },

    {
      description: "Empty diagnostic URL means turn it off",
      idsProjectName: "project-name",
      suffix: "telemetry",
      runtimeDiagnosticsUrl: "",
      expectedUrl: undefined,
    },

    {
      description:
        "No diagnostics URL provided means generate one (custom suffix)",
      idsProjectName: "project-name",
      suffix: "telemetry",
      runtimeDiagnosticsUrl: undefined,
      expectedUrl: "https://install.determinate.systems/project-name/telemetry",
    },

    {
      description:
        "'-' as the diagnostics URL means generate one (custom suffix)",
      idsProjectName: "project-name",
      suffix: "telemetry",
      runtimeDiagnosticsUrl: "-",
      expectedUrl: "https://install.determinate.systems/project-name/telemetry",
    },

    {
      description:
        "No diagnostics URL provided means generate one (default suffix)",
      idsProjectName: "project-name",
      suffix: undefined,
      runtimeDiagnosticsUrl: undefined,
      expectedUrl:
        "https://install.determinate.systems/project-name/diagnostics",
    },

    {
      description:
        "Invalid user-provided diagnostic URL might be a whitespace-only string or otherwise, so use the default",
      idsProjectName: "project-name",
      runtimeDiagnosticsUrl: "http://hi:999999999999",
      expectedUrl:
        "https://install.determinate.systems/project-name/diagnostics",
    },
  ];

  for (const {
    description,
    idsProjectName,
    suffix,
    runtimeDiagnosticsUrl,
    expectedUrl,
  } of testCases) {
    test(description, async () => {
      const preEnv = process.env["IDS_HOST"];
      process.env["IDS_HOST"] = "https://install.determinate.systems";

      const host = new IdsHost(idsProjectName, suffix, runtimeDiagnosticsUrl);
      const diagUrl = await host.getDiagnosticsUrl();
      process.env["IDS_HOST"] = preEnv;

      expect(diagUrl).toStrictEqual(
        expectedUrl ? new URL(expectedUrl) : undefined,
      );
    });
  }
});

describe("recordToUrl", () => {
  test("a valid record", () => {
    expect(
      recordToUrl({
        name: "hi",
        port: 123,
        priority: 1,
        weight: 1,
      }),
    ).toStrictEqual(new URL("https://hi:123"));
  });

  test("an invalid record", () => {
    expect(
      recordToUrl({
        name: "!",
        port: 99999999999,
        priority: 1,
        weight: 1,
      }),
    ).toStrictEqual(undefined);
  });
});

describe("discoverServicesStub", async () => {
  type TestCase = {
    description: string;
    lookup: () => Promise<SrvRecord[]>;
    timeout?: number;
    expected: SrvRecord[];
  };

  const testCases: TestCase[] = [
    {
      description: "lookup has an exception",
      lookup: async () => {
        throw new Error("oops");
      },
      expected: [],
      timeout: 0,
    },

    {
      description: "basic in / out",
      lookup: async () => {
        return mkPromise(() => {
          return [mkRecord(1)];
        });
      },
      expected: [mkRecord(1)],
    },

    {
      description: "Records with invalid suffixes are omitted",
      lookup: async () => {
        return mkPromise(() => {
          return [
            mkRecord(1, 1, "mallory.com"),
            mkRecord(1, 1, "install.detsys.dev"),
            mkRecord(1, 1, "install.determinate.systems"),
          ];
        });
      },
      expected: [
        mkRecord(1, 1, "install.detsys.dev"),
        mkRecord(1, 1, "install.determinate.systems"),
      ],
    },

    {
      description: "lookup loses the race",
      lookup: async () => {
        return new Promise((r) => setTimeout(r, 1000, [mkRecord(123)]));
      },
      expected: [],
      timeout: 100,
    },
    {
      description: "lookup wins the race",
      lookup: async () => {
        return new Promise((r) => setTimeout(r, 100, [mkRecord(456)]));
      },
      expected: [mkRecord(456)],
      timeout: 1000,
    },
  ];

  for (const { description, lookup, timeout, expected } of testCases) {
    test(description, async () => {
      const ret = await discoverServicesStub(lookup(), timeout || 0);
      expect(ret).toStrictEqual(expected);
    });
  }
});

test("orderRecordsByPriorityWeight does that", () => {
  expect(
    orderRecordsByPriorityWeight([
      mkRecord(3, 3),
      mkRecord(1000, 1),
      mkRecord(2, 2),
      mkRecord(1, 1),
    ]),
  ).toStrictEqual([
    mkRecord(1000, 1),
    mkRecord(1, 1),
    mkRecord(2, 2),
    mkRecord(3, 3),
  ]);
});

test("weightedRandom handles empty and single-element records", () => {
  expect(weightedRandom([]), "one element passes through").toStrictEqual([]);

  expect(
    weightedRandom([mkRecord(1)]),
    "empty lists aren't crashing",
  ).toStrictEqual([mkRecord(1)]);
});

test("weightedRandom orders records acceptably predictably", () => {
  const records: SrvRecord[] = [mkRecord(1), mkRecord(2), mkRecord(3)];

  const counts: Map<number, number> = new Map();
  counts.set(1, 0);
  counts.set(2, 0);
  counts.set(3, 0);

  const iterations = 1_000;

  for (let i = 0; i < iterations; i++) {
    const weighted = weightedRandom(records);
    counts.set(
      weighted[0].weight,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      counts.get(weighted[0].weight)! + 1,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const firstPlaceSum1 = counts.get(1)!;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const firstPlaceSum2 = counts.get(2)!;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const firstPlaceSum3 = counts.get(3)!;

  assert.equal(firstPlaceSum1 + firstPlaceSum2 + firstPlaceSum3, iterations);

  assert.closeTo(
    firstPlaceSum3 / iterations,
    3 / 6,
    1 / 6,
    "3 should be first approximately 3/6 of the time",
  );
  assert.closeTo(
    firstPlaceSum2 / iterations,
    2 / 6,
    1 / 6,
    "2 should be first approximately 2/6 of the time",
  );
  assert.closeTo(
    firstPlaceSum1 / iterations,
    1 / 6,
    1 / 6,
    "1 should be first approximately 1/6 of the time",
  );
});

import * as otel from "./telemetry.js";
import { ROOT_CONTEXT, trace } from "@opentelemetry/api";
import { parseKeyPairsIntoRecord } from "@opentelemetry/core";
import { afterEach, describe, expect, test } from "vitest";

// These run with no provider registered, which is the default for any run that
// hasn't opted into OTLP export. The whole design leans on the OpenTelemetry
// API being a no-op in that state, so that instrumentation call sites need no
// branching: this is where we hold that guarantee down.

test("the tracer and logger are safe to use with no provider registered", () => {
  expect(() =>
    otel.getTracer().startSpan("nobody-is-listening").end(),
  ).not.toThrow();
  expect(() => otel.getLogger().emit({ body: "into the void" })).not.toThrow();
});

test("withSpan returns the callback's value when telemetry is disabled", async () => {
  expect(await otel.withSpan("disabled", async () => "value")).toBe("value");
});

test("withSpan re-throws rather than swallowing", async () => {
  await expect(
    otel.withSpan("boom", async () => {
      throw new Error("kaboom");
    }),
  ).rejects.toThrow("kaboom");
});

test("traceparentOf declines to serialize a non-recording span", () => {
  // Without a provider the span context is all zeroes, which is not a valid
  // parent. Serializing it would strand the child in a bogus trace.
  expect(
    otel.traceparentOf(otel.getTracer().startSpan("no-op")),
  ).toBeUndefined();
  expect(otel.traceparentOf(undefined)).toBeUndefined();
});

test("contextFromTraceparent recovers the span context from a traceparent", () => {
  const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
  const spanId = "00f067aa0ba902b7";

  const context = otel.contextFromTraceparent(`00-${traceId}-${spanId}-01`);
  const spanContext = trace.getSpanContext(context);

  expect(spanContext?.traceId).toBe(traceId);
  expect(spanContext?.spanId).toBe(spanId);
});

test("contextFromTraceparent falls back to the root context on junk input", () => {
  expect(otel.contextFromTraceparent(undefined)).toBe(ROOT_CONTEXT);
  expect(otel.contextFromTraceparent("")).toBe(ROOT_CONTEXT);
  expect(
    trace.getSpanContext(otel.contextFromTraceparent("not-a-traceparent")),
  ).toBe(undefined);
});

describe("exportEnabled", () => {
  afterEach(() => {
    delete process.env["OTEL_SDK_DISABLED"];
    delete process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];
  });

  test("every run exports by default", () => {
    expect(otel.exportEnabled()).toBe(true);
  });

  test("OTEL_SDK_DISABLED turns the export off", () => {
    process.env["OTEL_SDK_DISABLED"] = "true";
    expect(otel.exportEnabled()).toBe(false);
  });

  test("an empty OTEL_EXPORTER_OTLP_ENDPOINT turns the export off", () => {
    // This escape hatch predates OTEL_SDK_DISABLED, and workflows use it.
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = "";
    expect(otel.exportEnabled()).toBe(false);
  });

  test("a collector of the user's own keeps the export on", () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = "https://otlp.example.com";
    expect(otel.exportEnabled()).toBe(true);
  });
});

describe("applyOtlpEnvironmentDefaults", () => {
  // The exporters read their whole configuration from the environment. These
  // hold down what this library puts there and what it leaves alone.

  const otlpVariables = [
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "OTEL_EXPORTER_OTLP_HEADERS",
    "OTEL_EXPORTER_OTLP_COMPRESSION",
    "OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT",
  ];

  afterEach(() => {
    for (const variable of otlpVariables) {
      delete process.env[variable];
    }
  });

  test("points an unconfigured run at our collector, with its token", () => {
    otel.applyOtlpEnvironmentDefaults();

    expect(process.env["OTEL_EXPORTER_OTLP_ENDPOINT"]).toBe(
      "https://otel.determinate.systems",
    );
    expect(
      parseKeyPairsIntoRecord(process.env["OTEL_EXPORTER_OTLP_HEADERS"])[
        "Authorization"
      ],
    ).toMatch(/^Bearer [0-9a-f]{64}$/);
  });

  test("sends no token to a collector of the user's own", () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = "https://otlp.example.com";

    otel.applyOtlpEnvironmentDefaults();

    expect(process.env["OTEL_EXPORTER_OTLP_ENDPOINT"]).toBe(
      "https://otlp.example.com",
    );
    expect(process.env["OTEL_EXPORTER_OTLP_HEADERS"]).toBeUndefined();
  });

  test("authenticates when the user names our collector explicitly", () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] =
      "https://otel.determinate.systems";

    otel.applyOtlpEnvironmentDefaults();

    expect(process.env["OTEL_EXPORTER_OTLP_HEADERS"]).toBeDefined();
  });

  test("keeps a token the user supplied", () => {
    process.env["OTEL_EXPORTER_OTLP_HEADERS"] = "authorization=Bearer%20theirs";

    otel.applyOtlpEnvironmentDefaults();

    expect(process.env["OTEL_EXPORTER_OTLP_HEADERS"]).toBe(
      "authorization=Bearer%20theirs",
    );
  });

  test("keeps every other setting the user made", () => {
    process.env["OTEL_EXPORTER_OTLP_COMPRESSION"] = "none";
    process.env["OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT"] = "128";

    otel.applyOtlpEnvironmentDefaults();

    expect(process.env["OTEL_EXPORTER_OTLP_COMPRESSION"]).toBe("none");
    expect(process.env["OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT"]).toBe("128");
  });

  test("hands a child process the settings it needs", () => {
    otel.applyOtlpEnvironmentDefaults();

    expect(Object.keys(otel.otlpExportEnvironment()).sort()).toStrictEqual([
      "OTEL_EXPORTER_OTLP_COMPRESSION",
      "OTEL_EXPORTER_OTLP_ENDPOINT",
      "OTEL_EXPORTER_OTLP_HEADERS",
    ]);
  });
});

describe("encodeOtlpHeaders", () => {
  test("is empty for no headers", () => {
    expect(otel.encodeOtlpHeaders({})).toBe("");
  });

  test("percent-encodes values, because the reader decodes them", () => {
    // The SDK reads this value from the environment.
    // A space that you do not encode divides `Bearer` from the token.
    expect(otel.encodeOtlpHeaders({ Authorization: "Bearer abc123" })).toBe(
      "Authorization=Bearer%20abc123",
    );
  });

  test("round-trips through the reader's parser", () => {
    const headers = { Authorization: "Bearer abc123", other: "value" };

    expect(
      parseKeyPairsIntoRecord(otel.encodeOtlpHeaders(headers)),
    ).toStrictEqual(headers);
  });

  test("joins multiple headers with a comma", () => {
    expect(otel.encodeOtlpHeaders({ a: "1", b: "2" })).toBe("a=1,b=2");
  });
});

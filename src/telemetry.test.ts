import * as otel from "./telemetry.js";
import { ROOT_CONTEXT, trace } from "@opentelemetry/api";
import { parseKeyPairsIntoRecord } from "@opentelemetry/core";
import { afterEach, assert, describe, expect, test } from "vitest";

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

describe("otlpEndpoint", () => {
  // The OTLP base endpoint, in the shape of OTEL_EXPORTER_OTLP_ENDPOINT: the
  // exporters append `/v1/traces` and `/v1/logs` to whatever this returns.

  afterEach(() => {
    delete process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];
  });

  test("is the statically configured collector by default", () => {
    expect(otel.otlpEndpoint()).toStrictEqual(
      new URL("https://otel.determinate.systems"),
    );
  });

  test("OTEL_EXPORTER_OTLP_ENDPOINT wins over the default", () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = "https://otlp.example.com/v1";
    expect(otel.otlpEndpoint()).toStrictEqual(
      new URL("https://otlp.example.com/v1"),
    );
  });

  test("an empty OTEL_EXPORTER_OTLP_ENDPOINT disables export", () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = "";
    expect(otel.otlpEndpoint()).toBeUndefined();
  });

  test("an unparseable OTEL_EXPORTER_OTLP_ENDPOINT falls back to the default", () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = "not-a-url";
    expect(otel.otlpEndpoint()).toStrictEqual(
      new URL("https://otel.determinate.systems"),
    );
  });
});

describe("otlpHeaders", () => {
  afterEach(() => {
    delete process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];
  });

  test("authenticates against the statically configured collector", () => {
    expect(otel.otlpHeaders()["Authorization"]).toMatch(
      /^Bearer [0-9a-f]{64}$/,
    );
  });

  test("sends nothing to a different collector", () => {
    // A different collector must not receive our token.
    // A header here would also replace the user's OTEL_EXPORTER_OTLP_HEADERS.
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = "https://otlp.example.com";
    expect(otel.otlpHeaders()).toStrictEqual({});
  });

  test("authenticates when the default endpoint is named explicitly", () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] =
      "https://otel.determinate.systems";
    expect(otel.otlpHeaders()["Authorization"]).toBeDefined();
  });

  test("sends nothing when export is disabled", () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = "";
    expect(otel.otlpHeaders()).toStrictEqual({});
  });
});

describe("encodeOtlpHeaders", () => {
  test("is undefined for no headers, so the variable stays unset", () => {
    expect(otel.encodeOtlpHeaders({})).toBeUndefined();
  });

  test("percent-encodes values, because the reader decodes them", () => {
    // The SDK in the child process reads this value from the environment.
    // A space that you do not encode divides `Bearer` from the token.
    expect(otel.encodeOtlpHeaders({ Authorization: "Bearer abc123" })).toBe(
      "Authorization=Bearer%20abc123",
    );
  });

  test("round-trips through the child's parser", () => {
    const encoded = otel.encodeOtlpHeaders(otel.otlpHeaders());
    assert(encoded !== undefined);

    expect(parseKeyPairsIntoRecord(encoded)).toStrictEqual(otel.otlpHeaders());
  });

  test("joins multiple headers with a comma", () => {
    expect(otel.encodeOtlpHeaders({ a: "1", b: "2" })).toBe("a=1,b=2");
  });
});

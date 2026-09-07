import * as otel from "./telemetry.js";
import { ROOT_CONTEXT, trace } from "@opentelemetry/api";
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

describe("newTraceparent", () => {
  test("announces a sampled trace in the W3C format", () => {
    expect(otel.newTraceparent()).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  test("announces a different trace each time", () => {
    expect(otel.newTraceparent()).not.toBe(otel.newTraceparent());
  });

  test("announces a span in the trace of its parent", () => {
    const parent = otel.newTraceparent();
    const child = otel.newTraceparent(parent);

    const [, parentTraceId, parentSpanId] = parent.split("-");
    const [, childTraceId, childSpanId, childFlags] = child.split("-");

    expect(childTraceId).toBe(parentTraceId);
    expect(childSpanId).not.toBe(parentSpanId);
    expect(childFlags).toBe("01");
  });

  test("announces an unsampled span under an unsampled parent", () => {
    // The parent decides. Recording the child of a span nobody keeps would
    // leave the child with no parent to hang from.
    const parent = `00-${"a".repeat(32)}-${"b".repeat(16)}-00`;

    expect(otel.newTraceparent(parent).split("-")[3]).toBe("00");
  });

  test("announces a trace of its own when the parent is not usable", () => {
    expect(otel.newTraceparent("not-a-traceparent")).toMatch(
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/,
    );
  });

  test("announces an identity the reader recovers", () => {
    const traceparent = otel.newTraceparent();
    const spanContext = trace.getSpanContext(
      otel.contextFromTraceparent(traceparent),
    );

    expect(spanContext).toBeDefined();
    expect(traceparent).toContain(spanContext?.traceId);
    expect(traceparent).toContain(spanContext?.spanId);
  });
});

describe("traceContextHeaders", () => {
  afterEach(() => {
    delete process.env["TRACEPARENT"];
  });

  test("are empty when there is no trace to join", () => {
    // No provider is registered, so the active span is a no-op whose context
    // is all zeroes. Sending it would strand the service in a bogus trace.
    expect(otel.traceContextHeaders()).toStrictEqual({});
  });

  test("carry the trace of the job when no span is active", () => {
    // The Action makes requests before it opens a span of its own. The job's
    // trace is what puts those requests somewhere sensible.
    const traceparent = otel.newTraceparent();
    process.env["TRACEPARENT"] = traceparent;

    expect(otel.traceContextHeaders()).toStrictEqual({ traceparent });
  });

  test("ignore a traceparent that is not usable", () => {
    process.env["TRACEPARENT"] = "not-a-traceparent";

    expect(otel.traceContextHeaders()).toStrictEqual({});
  });
});

/** Put back the environment of a run that configured nothing. */
function clearOtelEnvironment(): void {
  for (const name of Object.keys(process.env)) {
    if (name.startsWith("OTEL_")) {
      delete process.env[name];
    }
  }
}

describe("exportEnabled", () => {
  afterEach(clearOtelEnvironment);

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

describe("otlpConfig", () => {
  // This library writes no environment variable. It reads them to answer one
  // question, for each signal: did the user name a collector for it?

  afterEach(clearOtelEnvironment);

  test("sends a signal the user says nothing about to our collector", () => {
    const { exporter, limits } = otel.otlpConfig("traces");

    expect(exporter.url).toBe("https://otel.determinate.systems/v1/traces");
    expect(exporter.headers?.["Authorization"]).toMatch(
      /^Bearer [0-9a-f]{64}$/,
    );
    expect(exporter.compression).toBe("gzip");
    expect(limits.attributeValueLengthLimit).toBe(8192);
  });

  test("names the path of each signal", () => {
    expect(otel.otlpConfig("logs").exporter.url).toBe(
      "https://otel.determinate.systems/v1/logs",
    );
  });

  test("gives the token when the user names our collector", () => {
    // Our collector refuses data that carries no token, wherever the name of
    // the collector came from.
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] =
      "https://otel.determinate.systems";

    expect(
      otel.otlpConfig("traces").exporter.headers?.["Authorization"],
    ).toMatch(/^Bearer [0-9a-f]{64}$/);
  });

  describe("a collector the user named", () => {
    // Such a user owns the configuration of that signal. This library adds
    // nothing to it, and above all adds no token: our credentials are for our
    // collector.

    test("is configured by the user alone", () => {
      process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = "https://otlp.example.com";
      process.env["OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT"] = "128";

      expect(otel.otlpConfig("traces")).toStrictEqual({
        exporter: {},
        limits: { attributeValueLengthLimit: 128 },
      });
    });

    test("takes the limit of the SDK when the user set none", () => {
      process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = "https://otlp.example.com";

      expect(
        otel.otlpConfig("traces").limits.attributeValueLengthLimit,
      ).toBeUndefined();
    });

    test("takes one signal, and leaves the other with us", () => {
      // Our token goes on a request to our collector and on no other request,
      // thus one signal going elsewhere does not strand the other.
      process.env["OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"] =
        "https://otlp.example.com";

      expect(otel.otlpConfig("traces").exporter).toStrictEqual({});
      expect(otel.otlpConfig("logs").exporter.url).toBe(
        "https://otel.determinate.systems/v1/logs",
      );
    });

    test("stays off when the user emptied the endpoint", () => {
      // This is the escape hatch of `exportEnabled`. Our collector must not
      // replace it, and must not receive the token.
      process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = "";

      expect(otel.otlpConfig("traces").exporter).toStrictEqual({});
    });
  });
});

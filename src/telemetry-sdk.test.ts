import { Telemetry, getTracer, traceparentOf } from "./telemetry.js";
import { isSpanContextValid } from "@opentelemetry/api";
import { afterEach, describe, expect, test } from "vitest";

// `Telemetry.start` registers global providers, which no later test in this
// process can undo. That is why these live in a file of their own.

// Nothing here should reach the network: the collector is a port nothing
// listens on, and a refused export is swallowed the same way a broken
// collector in a workflow would be.
const UNREACHABLE_COLLECTOR = "http://127.0.0.1:1";

describe("Telemetry", () => {
  afterEach(() => {
    delete process.env["OTEL_SDK_DISABLED"];
    delete process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];
    delete process.env["OTEL_EXPORTER_OTLP_HEADERS"];
    delete process.env["OTEL_EXPORTER_OTLP_COMPRESSION"];
    delete process.env["OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT"];
    delete process.env["OTEL_EXPORTER_OTLP_TIMEOUT"];
  });

  test("OTEL_SDK_DISABLED leaves the API in its no-op state", async () => {
    process.env["OTEL_SDK_DISABLED"] = "true";
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = UNREACHABLE_COLLECTOR;

    const telemetry = new Telemetry();
    telemetry.start({ serviceName: "test", resourceAttributes: {} });

    expect(telemetry.enabled).toBe(false);
    // A disabled run configures nothing, so a child process inherits nothing.
    expect(process.env["OTEL_EXPORTER_OTLP_HEADERS"]).toBeUndefined();

    const span = getTracer().startSpan("nobody-is-listening");
    expect(span.isRecording()).toBe(false);
    span.end();

    await telemetry.shutdown();
  });

  test("starting registers a real tracer and configures the exporters", async () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = UNREACHABLE_COLLECTOR;
    // Otherwise the exporter spends its whole default budget retrying the
    // refused connection, and the shutdown timeout is what ends the test.
    process.env["OTEL_EXPORTER_OTLP_TIMEOUT"] = "100";

    const telemetry = new Telemetry();
    telemetry.start({
      serviceName: "test",
      serviceVersion: "v1",
      resourceAttributes: { "detsys.project": "test" },
    });

    expect(telemetry.enabled).toBe(true);
    expect(process.env["OTEL_EXPORTER_OTLP_COMPRESSION"]).toBe("gzip");
    expect(process.env["OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT"]).toBe("8192");

    const span = getTracer().startSpan("recorded");
    expect(span.isRecording()).toBe(true);
    expect(isSpanContextValid(span.spanContext())).toBe(true);
    expect(traceparentOf(span)).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/);
    span.end();

    // A collector that refuses the connection must not fail the workflow.
    await expect(telemetry.shutdown()).resolves.toBeUndefined();
  });

  test("starting twice is a no-op", () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = UNREACHABLE_COLLECTOR;

    const telemetry = new Telemetry();
    telemetry.start({ serviceName: "test", resourceAttributes: {} });
    expect(() =>
      telemetry.start({ serviceName: "test", resourceAttributes: {} }),
    ).not.toThrow();
  });
});

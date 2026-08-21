import * as otel from "./telemetry.js";
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

    const telemetry = new otel.Telemetry();
    telemetry.start({ serviceName: "test", resourceAttributes: {} });

    expect(telemetry.enabled).toBe(false);
    // A disabled run configures nothing, so a child process inherits nothing.
    expect(process.env["OTEL_EXPORTER_OTLP_HEADERS"]).toBeUndefined();

    const span = otel.getTracer().startSpan("nobody-is-listening");
    expect(span.isRecording()).toBe(false);
    span.end();

    await telemetry.shutdown();
  });

  test("starting registers a real tracer and configures the exporters", async () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = UNREACHABLE_COLLECTOR;
    // Otherwise the exporter spends its whole default budget retrying the
    // refused connection, and the shutdown timeout is what ends the test.
    process.env["OTEL_EXPORTER_OTLP_TIMEOUT"] = "100";

    const telemetry = new otel.Telemetry();
    telemetry.start({
      serviceName: "test",
      serviceVersion: "v1",
      resourceAttributes: { "detsys.project": "test" },
    });

    expect(telemetry.enabled).toBe(true);
    expect(process.env["OTEL_EXPORTER_OTLP_COMPRESSION"]).toBe("gzip");
    expect(process.env["OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT"]).toBe("8192");

    const span = otel.getTracer().startSpan("recorded");
    expect(span.isRecording()).toBe(true);
    expect(isSpanContextValid(span.spanContext())).toBe(true);
    expect(otel.traceparentOf(span)).toMatch(
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/,
    );
    span.end();

    // A collector that refuses the connection must not fail the workflow.
    await expect(telemetry.shutdown()).resolves.toBeUndefined();
  });

  test("an announced span starts with the identity it was given", async () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = UNREACHABLE_COLLECTOR;
    process.env["OTEL_EXPORTER_OTLP_TIMEOUT"] = "100";

    const telemetry = new otel.Telemetry();
    telemetry.start({ serviceName: "test", resourceAttributes: {} });

    // This is the identity another Action of the same job announced.
    const traceparent = otel.newTraceparent();
    const startTime = new Date(Date.now() - 60_000);

    const span = telemetry.startAnnouncedSpan(
      "github_actions_job",
      traceparent,
      startTime,
    );

    expect(otel.traceparentOf(span)).toBe(traceparent);
    span?.end();

    // The identity belongs to that one span. Everything after it is its own.
    const next = otel.getTracer().startSpan("afterward");
    expect(otel.traceparentOf(next)).not.toBe(traceparent);
    next.end();

    await telemetry.shutdown();
  });

  test("an announced span that is not usable is skipped", () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = UNREACHABLE_COLLECTOR;

    const telemetry = new otel.Telemetry();
    telemetry.start({ serviceName: "test", resourceAttributes: {} });

    expect(
      telemetry.startAnnouncedSpan("job", "not-a-traceparent", new Date()),
    ).toBeUndefined();
  });

  test("the trace context headers describe the span in progress", async () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = UNREACHABLE_COLLECTOR;
    process.env["OTEL_EXPORTER_OTLP_TIMEOUT"] = "100";

    const telemetry = new otel.Telemetry();
    telemetry.start({ serviceName: "test", resourceAttributes: {} });

    await otel.withSpan("request", async (span) => {
      expect(otel.traceContextHeaders()["traceparent"]).toBe(
        otel.traceparentOf(span),
      );
    });

    await telemetry.shutdown();
  });

  test("starting twice is a no-op", () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = UNREACHABLE_COLLECTOR;

    const telemetry = new otel.Telemetry();
    telemetry.start({ serviceName: "test", resourceAttributes: {} });
    expect(() =>
      telemetry.start({ serviceName: "test", resourceAttributes: {} }),
    ).not.toThrow();
  });
});

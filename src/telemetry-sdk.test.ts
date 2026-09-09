import * as otel from "./telemetry.js";
import * as otelApi from "@opentelemetry/api";
import type { Span as SdkSpan } from "@opentelemetry/sdk-trace-base";
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
    expect(otelApi.isSpanContextValid(span.spanContext())).toBe(true);
    expect(otel.traceparentOf(span)).toMatch(
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/,
    );
    span.end();

    // A collector that refuses the connection must not fail the workflow.
    await expect(telemetry.shutdown()).resolves.toBeUndefined();
  });

  test("a phase span is the root of a trace of its own", async () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = UNREACHABLE_COLLECTOR;
    process.env["OTEL_EXPORTER_OTLP_TIMEOUT"] = "100";

    const telemetry = new otel.Telemetry();
    telemetry.start({ serviceName: "test", resourceAttributes: {} });

    // A phase opens its span in the root context, and thus joins no trace,
    // not even one the environment offers.
    process.env["TRACEPARENT"] = `00-${"a".repeat(32)}-${"b".repeat(16)}-01`;

    const main = otel
      .getTracer()
      .startSpan("action:main", {}, otelApi.ROOT_CONTEXT);
    const post = otel
      .getTracer()
      .startSpan("action:post", {}, otelApi.ROOT_CONTEXT);

    expect((main as SdkSpan).parentSpanContext).toBeUndefined();
    expect((post as SdkSpan).parentSpanContext).toBeUndefined();
    expect(main.spanContext().traceId).not.toBe(post.spanContext().traceId);
    expect(main.spanContext().traceId).not.toBe("a".repeat(32));

    main.end();
    post.end();

    delete process.env["TRACEPARENT"];

    await telemetry.shutdown();
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

  test("failActiveSpan fails the span in progress, and records no exception", async () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = UNREACHABLE_COLLECTOR;
    process.env["OTEL_EXPORTER_OTLP_TIMEOUT"] = "100";

    const telemetry = new otel.Telemetry();
    telemetry.start({ serviceName: "test", resourceAttributes: {} });

    // Nothing is in progress, thus there is nothing to fail.
    expect(() => otel.failActiveSpan("nobody is listening")).not.toThrow();

    await otel.withSpan("work", async (span) => {
      otel.failActiveSpan("it did not work");

      expect((span as SdkSpan).status).toStrictEqual({
        code: otelApi.SpanStatusCode.ERROR,
        message: "it did not work",
      });
      // A message this library wrote has no stack trace worth keeping.
      expect((span as SdkSpan).events).toStrictEqual([]);
    });

    await telemetry.shutdown();
  });

  test("withSpan gives the span the kind it is asked for", async () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = UNREACHABLE_COLLECTOR;
    process.env["OTEL_EXPORTER_OTLP_TIMEOUT"] = "100";

    const telemetry = new otel.Telemetry();
    telemetry.start({ serviceName: "test", resourceAttributes: {} });

    await otel.withSpan(
      "request",
      async (span) => {
        expect((span as SdkSpan).kind).toBe(otelApi.SpanKind.CLIENT);
      },
      {},
      otelApi.SpanKind.CLIENT,
    );

    // A span that asks for no kind is internal work.
    await otel.withSpan("work", async (span) => {
      expect((span as SdkSpan).kind).toBe(otelApi.SpanKind.INTERNAL);
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

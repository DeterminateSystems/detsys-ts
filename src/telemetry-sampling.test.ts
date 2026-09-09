import * as otel from "./telemetry.js";
import { describe, expect, test } from "vitest";

// `Telemetry.start` registers global providers that no later test in this
// process can undo, so this lives in a file of its own.

// Nothing here should reach the network: the collector is a port nothing
// listens on.
const UNREACHABLE_COLLECTOR = "http://127.0.0.1:1";

describe("sampling randomness", () => {
  test("a source names 56 bits of hexadecimal, and names them again", () => {
    const first = otel.samplingRandomnessOf("a-job");

    expect(first).toMatch(/^[0-9a-f]{14}$/);
    expect(otel.samplingRandomnessOf("a-job")).toBe(first);
    expect(otel.samplingRandomnessOf("another-job")).not.toBe(first);
  });

  test("the traces of one source report one randomness value", async () => {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = UNREACHABLE_COLLECTOR;
    process.env["OTEL_EXPORTER_OTLP_TIMEOUT"] = "1";

    const telemetry = new otel.Telemetry();
    telemetry.start({
      serviceName: "test",
      resourceAttributes: {},
      samplingRandomnessSource: "a-job",
    });

    const main = otel.getTracer().startSpan("nix-installer:main");
    const post = otel.getTracer().startSpan("nix-installer:post");

    const expected = `ot=rv:${otel.samplingRandomnessOf("a-job")}`;
    expect(main.spanContext().traceState?.serialize()).toBe(expected);
    expect(post.spanContext().traceState?.serialize()).toBe(expected);
    expect(main.spanContext().traceId).not.toBe(post.spanContext().traceId);

    main.end();
    post.end();

    await telemetry.shutdown();

    delete process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];
    delete process.env["OTEL_EXPORTER_OTLP_TIMEOUT"];
  });
});

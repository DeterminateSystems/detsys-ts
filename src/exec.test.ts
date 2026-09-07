import * as exec from "./exec.js";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  type ReadableSpan,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { afterEach, beforeAll, expect, test } from "vitest";

// A provider of this file's own, so that a span can be read back. It exports
// to memory and reaches no collector.
const exported = new InMemorySpanExporter();

beforeAll(() => {
  trace.setGlobalTracerProvider(
    new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exported)],
    }),
  );
});

afterEach(() => {
  exported.reset();
});

/** The one span the program that just ran recorded. */
function onlySpan(): ReadableSpan {
  const spans = exported.getFinishedSpans();
  expect(spans).toHaveLength(1);

  return spans[0];
}

test("records the program, its arguments, and what it exited with", async () => {
  expect(await exec.exec("sh", ["-c", "exit 0"])).toBe(0);

  const span = onlySpan();

  // The name is the program alone. A name that holds the arguments makes a new
  // name for each run.
  expect(span.name).toBe("sh");
  expect(span.attributes["process.executable.name"]).toBe("sh");
  expect(span.attributes["process.command_args"]).toStrictEqual([
    "sh",
    "-c",
    "exit 0",
  ]);
  expect(span.attributes["process.exit.code"]).toBe(0);
  expect(span.status.code).toBe(SpanStatusCode.UNSET);
});

test("fails the span of a program that fails", async () => {
  await expect(exec.exec("false", [])).rejects.toThrow();

  expect(onlySpan().status.code).toBe(SpanStatusCode.ERROR);
});

test("records the code a caller asked to ignore, and does not fail", async () => {
  // A program that reports something by exiting non-zero did its work.
  expect(
    await exec.exec("sh", ["-c", "exit 3"], { ignoreReturnCode: true }),
  ).toBe(3);

  const span = onlySpan();

  expect(span.attributes["process.exit.code"]).toBe(3);
  expect(span.status.code).toBe(SpanStatusCode.UNSET);
});

test("returns what the program wrote, and records only its code", async () => {
  // The program works the answer out, so that what it writes appears in no
  // argument of it.
  const output = await exec.getExecOutput("sh", ["-c", "echo $((21 + 21))"], {
    silent: true,
  });

  expect(output.exitCode).toBe(0);
  expect(output.stdout.trim()).toBe("42");

  const span = onlySpan();

  expect(span.attributes["process.exit.code"]).toBe(0);
  // A program can write more than a span should carry, thus the span carries
  // none of it.
  expect(JSON.stringify(span.attributes)).not.toContain("42");
});

test("runs a program that takes no arguments", async () => {
  expect(await exec.exec("true")).toBe(0);

  expect(onlySpan().attributes["process.command_args"]).toStrictEqual(["true"]);
});

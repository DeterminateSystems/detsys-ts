/**
 * @packageDocumentation
 * Running a program, in a span of its own.
 *
 * These are drop-in replacements for the `@actions/exec` functions. Each runs
 * the program exactly as before -- the arguments, the options, and the result
 * are unchanged -- and additionally records a span that covers the run.
 *
 * A program a workflow runs is most of what an Action does, and how long it
 * took is most of why an Action was slow. Without these the trace shows the
 * Action waiting and does not say what it waited for.
 *
 * When telemetry is disabled the span is the API's no-op, so these behave
 * identically to calling `@actions/exec` directly.
 */
import { withSpan } from "./telemetry.js";
import * as actionsExec from "@actions/exec";
import type { Attributes } from "@opentelemetry/api";
import * as semconvIncubating from "@opentelemetry/semantic-conventions/incubating";

/**
 * The attributes of one run of `command`.
 *
 * `process.command_args` holds the program and then its arguments, which is
 * what the conventions say it holds.
 *
 * Nothing here hides a secret in an argument, because nothing can: an argument
 * of a program is visible to every process on the machine. Do not put a secret
 * in one.
 */
function processAttributes(command: string, args: string[]): Attributes {
  return {
    [semconvIncubating.ATTR_PROCESS_EXECUTABLE_NAME]: command,
    [semconvIncubating.ATTR_PROCESS_COMMAND_ARGS]: [command, ...args],
  };
}

/**
 * The name of the span of one run of `command`.
 *
 * The name is the program, and not the program and its arguments.
 * A name that holds the arguments makes a new name for each run, and a backend
 * groups a span by its name.
 * The arguments are an attribute, where a reader still finds them.
 */
function spanName(command: string): string {
  return command;
}

/**
 * Run `command`, and return what it exited with.
 *
 * `@actions/exec` rejects on a non-zero exit unless `options.ignoreReturnCode`
 * says otherwise, and a rejection fails the span.
 * A program this Action expects to fail, such as one that reports whether a
 * feature exists, thus fails a span of its own and not the span above it.
 */
export async function exec(
  command: string,
  args: string[] = [],
  options?: actionsExec.ExecOptions,
): Promise<number> {
  return await withSpan(
    spanName(command),
    async (span) => {
      const exitCode = await actionsExec.exec(command, args, options);

      span.setAttribute(semconvIncubating.ATTR_PROCESS_EXIT_CODE, exitCode);

      return exitCode;
    },
    { attributes: processAttributes(command, args) },
  );
}

/**
 * Run `command`, and return what it exited with and what it wrote.
 *
 * The output does not reach the span. It is the caller's to record, and a
 * program can write more than a span should carry.
 */
export async function getExecOutput(
  command: string,
  args: string[] = [],
  options?: actionsExec.ExecOptions,
): Promise<actionsExec.ExecOutput> {
  return await withSpan(
    spanName(command),
    async (span) => {
      const output = await actionsExec.getExecOutput(command, args, options);

      span.setAttribute(
        semconvIncubating.ATTR_PROCESS_EXIT_CODE,
        output.exitCode,
      );

      return output;
    },
    { attributes: processAttributes(command, args) },
  );
}

/**
 * @packageDocumentation
 * Logging that tees to both the GitHub Actions console and OpenTelemetry.
 *
 * These are drop-in replacements for the `@actions/core` logging functions.
 * Every call still writes to the workflow log exactly as it did before -- the
 * user-visible output is unchanged -- and additionally emits an OpenTelemetry
 * LogRecord correlated to the currently active span.
 *
 * When telemetry is disabled the OpenTelemetry half is a no-op, so these
 * behave identically to calling `@actions/core` directly.
 */
import { stringifyError } from "./errors.js";
import {
  type LogLevel,
  emitLogRecord,
  failActiveSpan,
  withSpan,
} from "./telemetry.js";
import * as actionsCore from "@actions/core";
import type { Attributes, Span } from "@opentelemetry/api";

/**
 * `@actions/core` accepts an Error in place of a message for the annotation
 * functions, and renders it via `toString()`.
 */
type Message = string | Error;

function tee(
  level: LogLevel,
  message: Message,
  attributes?: Attributes,
): string {
  const text = typeof message === "string" ? message : stringifyError(message);

  emitLogRecord(level, text, attributes);

  return text;
}

/**
 * Write a debug message. Only visible in the workflow log when the user has
 * enabled step debug logging, but always exported to OpenTelemetry.
 */
export function debug(message: string, attributes?: Attributes): void {
  actionsCore.debug(tee("debug", message, attributes));
}

/** Write an informational message to the workflow log. */
export function info(message: string, attributes?: Attributes): void {
  actionsCore.info(tee("info", message, attributes));
}

/** Write a notice annotation to the workflow log. */
export function notice(
  message: Message,
  properties?: actionsCore.AnnotationProperties,
  attributes?: Attributes,
): void {
  tee("notice", message, attributes);
  actionsCore.notice(message, properties);
}

/** Write a warning annotation to the workflow log. */
export function warning(
  message: Message,
  properties?: actionsCore.AnnotationProperties,
  attributes?: Attributes,
): void {
  tee("warning", message, attributes);
  actionsCore.warning(message, properties);
}

/** Write an error annotation to the workflow log. */
export function error(
  message: Message,
  properties?: actionsCore.AnnotationProperties,
  attributes?: Attributes,
): void {
  tee("error", message, attributes);
  actionsCore.error(message, properties);
}

/**
 * Fail the workflow step, recording the reason as an OpenTelemetry error log.
 *
 * The span in progress is the work that failed, thus it gets the error
 * status. The phase's root span gets one too, in `Action.concludePhaseSpan`:
 * a failed step is a failed phase, and a query for failed runs reads the
 * root.
 */
export function setFailed(message: Message, attributes?: Attributes): void {
  failActiveSpan(tee("error", message, attributes));
  actionsCore.setFailed(message);
}

/**
 * Represents a collapsable log group and span.
 */
export interface Group {
  /** The span of this group. */
  span: Span;
}

/**
 * Run a callback inside both a collapsible group in the workflow log and an active
 * OpenTelemetry span.
 *
 * This replaces `startGroup`/`endGroup`: the group closes
 * and the span ends even if `fn` throws, and a throwing `fn` marks the span
 * failed before re-throwing.
 *
 * `name` is the span name and `label` is the console heading
 *
 * @param name - The span name, such as `install_nix`.
 * @param label - The heading of the group in the workflow log.
 * @param fn - The work of the group. It receives the group's span.
 * @param attributes - Attributes for the span.
 */
export async function group<T>(
  name: string,
  label: string,
  fn: (group: Group) => Promise<T>,
  attributes?: Attributes,
): Promise<T> {
  return await withSpan(
    name,
    async (span) => {
      actionsCore.startGroup(label);
      try {
        return await fn({ span });
      } finally {
        actionsCore.endGroup();
      }
    },
    attributes,
  );
}

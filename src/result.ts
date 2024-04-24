import * as actionsCore from "@actions/core";
import { Ok, Result as TsResult } from "ts-results";

/**
 * An algebraic return type directly inspired by Rust's `Result`.
 */
export type Result<T> = TsResult<T, string>;

/**
 * Convert a `Result<T>` into a `T` (if okay) or throw an `Error` with a message.
 */
export function handle<T>(res: Result<T>): T {
  if (res.ok) {
    return res.val;
  } else {
    throw new Error(res.val);
  }
}

/**
 * Coerce an error into a string.
 */
export function coerceErrorToString(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  } else if (typeof e === "string") {
    return e;
  } else {
    return `unknown error: ${e}`;
  }
}

/**
 * If the supplied hook function returns an error, log that error using the
 * Actions toolkit.
 */
export async function handleHook(
  callback: Promise<Result<void>>,
): Promise<void> {
  const res = await callback;
  if (res.err) {
    actionsCore.error(res.val);
  }
}

/**
 * A useful constant for declaring success as an `Ok<void>`.
 */
export const SUCCESS: Ok<void> = Ok(undefined);

// Public exports from ts-results
export { Err, Ok } from "ts-results";

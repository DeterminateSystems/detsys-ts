import * as actionsCore from "@actions/core";
import { Ok, Result as TsResult } from "ts-results";

/**
 * An algebraic return type directly inspired by Rust's `Result`.
 */
export type Result<T> = TsResult<T, string>;

/**
 * Convert a `Result<T>` into a `T` (if okay) or fail the Action (if error).
 */
export function handle<T>(res: Result<T>): T {
  if (res.ok) {
    return res.val;
  } else {
    actionsCore.setFailed(res.val);
    // The Action has already failed so this should have no effect (save
    // satisfying the TypeScript compiler)
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
 * If the supplied hook function returns an error, fail the Action with the
 * error message supplied by the callback.
 */
export async function handleHook(
  callback: Promise<Result<string>>,
): Promise<void> {
  const res = await callback;
  if (res.err) {
    actionsCore.setFailed(res.val);
  }
}

/**
 * A useful constant for declaring success as an `Ok<void>`.
 */
export const SUCCESS: Ok<void> = Ok(undefined);

// Public exports from ts-results
export { Err, Ok } from "ts-results";

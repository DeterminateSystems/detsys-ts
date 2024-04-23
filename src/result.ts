import * as actionsCore from "@actions/core";
import { Result as TsResult } from "ts-results";

/**
 * An algebraic return type directly inspired by Rust's `Result`.
 */
export type Result<T> = TsResult<T, string>;

/**
 * Convert a `Result<T>` into a `T` (if okay) or throw an `Error` with a message.
 */
export const handle = <T>(res: Result<T>): T => {
  if (res.ok) {
    return res.val;
  } else {
    throw new Error(res.val);
  }
};

/**
 * Coerce an error into a string.
 */
export const coerceErrorToString = (e: unknown): string => {
  if (e instanceof Error) {
    return e.message;
  } else if (typeof e === "string") {
    return e;
  } else {
    return `unknown error: ${e}`;
  }
};

/**
 * If the supplied hook function returns an error, log that error using the
 * Actions toolkit.
 */
export const handleHook = async (
  callback: Promise<Result<void>>,
): Promise<void> => {
  const res = await callback;
  if (res.err) {
    actionsCore.error(res.val);
  }
};

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
  } else {
    return `unknown error: ${e}`;
  }
};

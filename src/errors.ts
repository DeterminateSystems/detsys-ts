/** Coerce a value of type `unknown` into a string. */
export function stringifyError(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  } else if (typeof e === "string") {
    return e;
  }
  return JSON.stringify(e);
}

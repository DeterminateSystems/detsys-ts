/**
 * @packageDocumentation
 * Helpers for getting values from an Action's configuration.
 */
import * as actionsCore from "@actions/core";

/**
 * Get a Boolean input from the Action's configuration by name.
 */
const getBool = (name: string): boolean => {
  return actionsCore.getBooleanInput(name);
};

/**
 * Get a Boolean input from the Action's configuration by name, or undefined if it is unset.
 */
const getBoolOrUndefined = (name: string): boolean | undefined => {
  if (getStringOrUndefined(name) === undefined) {
    return undefined;
  }

  return actionsCore.getBooleanInput(name);
};

/**
 * The character used to separate values in the input string.
 */
export type Separator = "space" | "comma";

/**
 * Convert a comma-separated string input into an array of strings. If `comma` is selected,
 * all whitespace is removed from the string before converting to an array.
 */
const getArrayOfStrings = (name: string, separator: Separator): string[] => {
  const original = getString(name);
  return handleString(original, separator);
};

/**
 * Convert a string input into an array of strings or `null` if no value is set.
 */
const getArrayOfStringsOrNull = (
  name: string,
  separator: Separator,
): string[] | null => {
  const original = getStringOrNull(name);
  if (original === null) {
    return null;
  } else {
    return handleString(original, separator);
  }
};

// Split out this function for use in testing
export const handleString = (input: string, separator: Separator): string[] => {
  const sepChar = separator === "comma" ? "," : /\s+/;
  const trimmed = input.trim(); // Remove whitespace at the beginning and end
  if (trimmed === "") {
    return [];
  }

  return trimmed.split(sepChar).map((s: string) => s.trim());
};

/**
 * Get a multi-line string input from the Action's configuration by name or return `null` if not set.
 */
const getMultilineStringOrNull = (name: string): string[] | null => {
  const value = actionsCore.getMultilineInput(name);
  if (value.length === 0) {
    return null;
  } else {
    return value;
  }
};

/**
 * Get a number input from the Action's configuration by name or return `null` if not set.
 */
const getNumberOrNull = (name: string): number | null => {
  const value = actionsCore.getInput(name);
  if (value === "") {
    return null;
  } else {
    return Number(value);
  }
};

/**
 * Get a Number input from the Action's configuration by name, or undefined if it is unset.
 */
const getNumberOrUndefined = (name: string): number | undefined => {
  const value = getStringOrUndefined(name);
  if (value === undefined) {
    return undefined;
  }

  return Number(value);
};

/**
 * Get a string input from the Action's configuration.
 */
const getString = (name: string): string => {
  return actionsCore.getInput(name);
};

/**
 * Get a string input from the Action's configuration by name or return `null` if not set.
 */
const getStringOrNull = (name: string): string | null => {
  const value = actionsCore.getInput(name);
  if (value === "") {
    return null;
  } else {
    return value;
  }
};

/**
 * Get a string input from the Action's configuration by name or return `undefined` if not set.
 */
const getStringOrUndefined = (name: string): string | undefined => {
  const value = actionsCore.getInput(name);
  if (value === "") {
    return undefined;
  } else {
    return value;
  }
};

export {
  getBool,
  getBoolOrUndefined,
  getArrayOfStrings,
  getArrayOfStringsOrNull,
  getMultilineStringOrNull,
  getNumberOrNull,
  getNumberOrUndefined,
  getString,
  getStringOrNull,
  getStringOrUndefined,
};

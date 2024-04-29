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

// Split out this function for use in testing
export const handleString = (input: string, separator: Separator): string[] => {
  const sepChar = separator === "comma" ? "," : /\s+/;
  return input
    .trim() // Remove whitespace at the beginning and end
    .split(sepChar)
    .map((s: string) => s.trim());
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
  getArrayOfStrings,
  getMultilineStringOrNull,
  getNumberOrNull,
  getString,
  getStringOrNull,
  getStringOrUndefined,
};

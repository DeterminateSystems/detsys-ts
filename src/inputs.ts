/**
 * @packageDocumentation
 * Helpers for getting values from an Action's configuration.
 */
import * as actionsCore from "@actions/core";

/**
 * Get a Boolean input from the Action's configuration by name.
 *
 * @param name
 * @returns boolean
 */
const getBool = (name: string): boolean => {
  return actionsCore.getBooleanInput(name);
};

/**
 * Get a multi-line string input from the Action's configuration by name or return `null` if not set.
 *
 * @param name
 * @returns string[] | null
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
 *
 * @param name
 * @returns number | null
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
 *
 * @param name
 * @returns string
 */
const getString = (name: string): string => {
  return actionsCore.getInput(name);
};

/**
 * Get a string input from the Action's configuration by name or return `null` if not set.
 *
 * @param name
 * @returns string | null
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
 *
 * @param name
 * @returns string | undefined
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
  getMultilineStringOrNull,
  getNumberOrNull,
  getString,
  getStringOrNull,
  getStringOrUndefined,
};

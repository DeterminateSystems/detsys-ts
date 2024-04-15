/**
 * @packageDocumentation
 * Helpers for getting values from an Action's configuration.
 */
import * as actionsCore from "@actions/core";
/**
 * Get a Boolean input from the Action's configuration by name.
 */
const getBool = (name) => {
    return actionsCore.getBooleanInput(name);
};
/**
 * Get a multi-line string input from the Action's configuration by name or return `null` if not set.
 */
const getMultilineStringOrNull = (name) => {
    const value = actionsCore.getMultilineInput(name);
    if (value.length === 0) {
        return null;
    }
    else {
        return value;
    }
};
/**
 * Get a number input from the Action's configuration by name or return `null` if not set.
 */
const getNumberOrNull = (name) => {
    const value = actionsCore.getInput(name);
    if (value === "") {
        return null;
    }
    else {
        return Number(value);
    }
};
/**
 * Get a string input from the Action's configuration.
 */
const getString = (name) => {
    return actionsCore.getInput(name);
};
/**
 * Get a string input from the Action's configuration by name or return `null` if not set.
 */
const getStringOrNull = (name) => {
    const value = actionsCore.getInput(name);
    if (value === "") {
        return null;
    }
    else {
        return value;
    }
};
/**
 * Get a string input from the Action's configuration by name or return `undefined` if not set.
 */
const getStringOrUndefined = (name) => {
    const value = actionsCore.getInput(name);
    if (value === "") {
        return undefined;
    }
    else {
        return value;
    }
};
export { getBool, getMultilineStringOrNull, getNumberOrNull, getString, getStringOrNull, getStringOrUndefined, };

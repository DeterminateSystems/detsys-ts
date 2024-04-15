import * as actionsCore from "@actions/core";

const getBool = (name: string): boolean => {
  return actionsCore.getBooleanInput(name);
};

const getMultilineStringOrNull = (name: string): string[] | null => {
  const value = actionsCore.getMultilineInput(name);
  if (value.length === 0) {
    return null;
  } else {
    return value;
  }
};

const getNumberOrNull = (name: string): number | null => {
  const value = actionsCore.getInput(name);
  if (value === "") {
    return null;
  } else {
    return Number(value);
  }
};

const getStringOrNull = (name: string): string | null => {
  const value = actionsCore.getInput(name);
  if (value === "") {
    return null;
  } else {
    return value;
  }
};

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
  getStringOrNull,
  getStringOrUndefined,
};

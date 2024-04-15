import * as actionsCore from "@actions/core";

const actionInputBool = (name: string): boolean => {
  return actionsCore.getBooleanInput(name);
};

const actionInputMultilineStringOrNull = (name: string): string[] | null => {
  const value = actionsCore.getMultilineInput(name);
  if (value.length === 0) {
    return null;
  } else {
    return value;
  }
};

const actionInputNumberOrNull = (name: string): number | null => {
  const value = actionsCore.getInput(name);
  if (value === "") {
    return null;
  } else {
    return Number(value);
  }
};

const actionInputString = (name: string): string => {
  return actionsCore.getInput(name);
};

const actionInputStringOrNull = (name: string): string | null => {
  const value = actionsCore.getInput(name);
  if (value === "") {
    return null;
  } else {
    return value;
  }
};

export {
  actionInputBool,
  actionInputMultilineStringOrNull,
  actionInputNumberOrNull,
  actionInputString,
  actionInputStringOrNull,
};

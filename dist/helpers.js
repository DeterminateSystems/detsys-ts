import * as actionsCore from "@actions/core";
const actionInputBool = (name) => {
    return actionsCore.getBooleanInput(name);
};
const actionInputMultilineStringOrNull = (name) => {
    const value = actionsCore.getMultilineInput(name);
    if (value.length === 0) {
        return null;
    }
    else {
        return value;
    }
};
const actionInputNumberOrNull = (name) => {
    const value = actionsCore.getInput(name);
    if (value === "") {
        return null;
    }
    else {
        return Number(value);
    }
};
const actionInputString = (name) => {
    return actionsCore.getInput(name);
};
const actionInputStringOrNull = (name) => {
    const value = actionsCore.getInput(name);
    if (value === "") {
        return null;
    }
    else {
        return value;
    }
};
const actionInputStringOrUndefined = (name) => {
    const value = actionsCore.getInput(name);
    if (value === "") {
        return undefined;
    }
    else {
        return value;
    }
};
export { actionInputBool, actionInputMultilineStringOrNull, actionInputNumberOrNull, actionInputString, actionInputStringOrNull, actionInputStringOrUndefined, };

import * as actionsCore from "@actions/core";
const getBool = (name) => {
    return actionsCore.getBooleanInput(name);
};
const getMultilineStringOrNull = (name) => {
    const value = actionsCore.getMultilineInput(name);
    if (value.length === 0) {
        return null;
    }
    else {
        return value;
    }
};
const getNumberOrNull = (name) => {
    const value = actionsCore.getInput(name);
    if (value === "") {
        return null;
    }
    else {
        return Number(value);
    }
};
const getStringOrNull = (name) => {
    const value = actionsCore.getInput(name);
    if (value === "") {
        return null;
    }
    else {
        return value;
    }
};
const getStringOrUndefined = (name) => {
    const value = actionsCore.getInput(name);
    if (value === "") {
        return undefined;
    }
    else {
        return value;
    }
};
export { getBool, getMultilineStringOrNull, getNumberOrNull, getStringOrNull, getStringOrUndefined, };

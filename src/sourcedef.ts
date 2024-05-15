import { getStringOrUndefined } from "./inputs.js";
import * as actionsCore from "@actions/core";

export type SourceDef = {
  path?: string;
  url?: string;
  tag?: string;
  pr?: string;
  branch?: string;
  revision?: string;
};

export function constructSourceParameters(legacyPrefix?: string): SourceDef {
  return {
    path: noisilyGetInput("path", legacyPrefix),
    url: noisilyGetInput("url", legacyPrefix),
    tag: noisilyGetInput("tag", legacyPrefix),
    pr: noisilyGetInput("pr", legacyPrefix),
    branch: noisilyGetInput("branch", legacyPrefix),
    revision: noisilyGetInput("revision", legacyPrefix),
  };
}

function noisilyGetInput(
  suffix: string,
  legacyPrefix: string | undefined,
): string | undefined {
  const preferredInput = getStringOrUndefined(`source-${suffix}`);

  if (!legacyPrefix) {
    return preferredInput;
  }

  // Remaining is for handling cases where the legacy prefix
  // should be examined.
  const legacyInput = getStringOrUndefined(`${legacyPrefix}-${suffix}`);

  if (preferredInput && legacyInput) {
    actionsCore.warning(
      `The supported option source-${suffix} and the legacy option ${legacyPrefix}-${suffix} are both set. Preferring source-${suffix}. Please stop setting ${legacyPrefix}-${suffix}.`,
    );
    return preferredInput;
  } else if (legacyInput) {
    actionsCore.warning(
      `The legacy option ${legacyPrefix}-${suffix} is set. Please migrate to source-${suffix}.`,
    );
    return legacyInput;
  } else {
    return preferredInput;
  }
}

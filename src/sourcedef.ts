import { actionInputStringOrUndefined } from "./helpers.js";
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
  const noisilyGetInput = (suffix: string): string | undefined => {
    const preferredInput = actionInputStringOrUndefined(`source-${suffix}`);

    if (!legacyPrefix) {
      return preferredInput;
    }

    // Remaining is for handling cases where the legacy prefix
    // should be examined.
    const legacyInput = actionInputStringOrUndefined(
      `${legacyPrefix}-${suffix}`,
    );

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
  };

  return {
    path: noisilyGetInput("path"),
    url: noisilyGetInput("url"),
    tag: noisilyGetInput("tag"),
    pr: noisilyGetInput("pr"),
    branch: noisilyGetInput("branch"),
    revision: noisilyGetInput("revision"),
  };
}

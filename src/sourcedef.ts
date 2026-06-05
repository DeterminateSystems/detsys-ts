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

/**
 * Throw if hash-locking is requested against a source that is not pinned to a
 * fixed version. `source-tag`, `source-revision`, and `source-url` are
 * immutable (or caller-controlled); any other selector resolves to a moving
 * target (`branch`, `pr`, or the `stable` fallback) where the pinned checksum
 * would break the moment a new release is published.
 */
export function assertChecksumSourceIsPinned(source: SourceDef): void {
  if (
    source.url === undefined &&
    source.tag === undefined &&
    source.revision === undefined
  ) {
    throw new Error(
      "Hash-locking via `source-checksums-url`/`source-checksums-sha256` requires a pinned source: set `source-tag`, `source-revision`, or `source-url`. Without one the action resolves to a moving target (e.g. `stable`) and the checksum will break the next time a release is published.",
    );
  }
}

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

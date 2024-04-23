/**
 * @packageDocumentation
 * Helpers for determining system attributes of the current runner.
 */
import { Result } from "./result.js";
import { Err, Ok } from "ts-results";

/**
 * Get the current architecture plus OS. Examples include `X64-Linux` and `ARM64-macOS`.
 */
export function getArchOs(): Result<string> {
  const envArch = process.env.RUNNER_ARCH;
  const envOs = process.env.RUNNER_OS;

  if (envArch && envOs) {
    return Ok(`${envArch}-${envOs}`);
  } else {
    return Err(
      `Can't identify the platform: RUNNER_ARCH or RUNNER_OS undefined (${envArch}-${envOs})`,
    );
  }
}

/**
 * Get the current Nix system. Examples include `x86_64-linux` and `aarch64-darwin`.
 */
export function getNixPlatform(archOs: string): Result<string> {
  const archOsMap: Map<string, string> = new Map([
    ["X64-macOS", "x86_64-darwin"],
    ["ARM64-macOS", "aarch64-darwin"],
    ["X64-Linux", "x86_64-linux"],
    ["ARM64-Linux", "aarch64-linux"],
  ]);

  const mappedTo = archOsMap.get(archOs);
  if (mappedTo) {
    return Ok(mappedTo);
  } else {
    return Err(`ArchOs (${archOs}) doesn't map to a supported Nix platform.`);
  }
}

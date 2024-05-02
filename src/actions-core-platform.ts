// MIT, mostly lifted from https://github.com/actions/toolkit/blob/5a736647a123ecf8582376bdaee833fbae5b3847/packages/core/src/platform.ts
// since it isn't in @actions/core 1.10.1 which is their current release as 2024-04-19.
// Changes: Replaced the lsb_release call in Linux with `linux-release-info` to parse the os-release file directly.
import { releaseInfo } from "./linux-release-info.js";
import * as actionsCore from "@actions/core";
import * as actionsExec from "@actions/exec";
import os from "os";

// The name and version of the Action runner's system.
type SystemInfo = {
  name: string;
  version: string;
};

// Get the name and version of the current Windows system.
async function getWindowsInfo(): Promise<SystemInfo> {
  const { stdout: version } = await actionsExec.getExecOutput(
    'powershell -command "(Get-CimInstance -ClassName Win32_OperatingSystem).Version"',
    undefined,
    {
      silent: true,
    },
  );

  const { stdout: name } = await actionsExec.getExecOutput(
    'powershell -command "(Get-CimInstance -ClassName Win32_OperatingSystem).Caption"',
    undefined,
    {
      silent: true,
    },
  );

  return {
    name: name.trim(),
    version: version.trim(),
  };
}

// Get the name and version of the current macOS system.
async function getMacOsInfo(): Promise<SystemInfo> {
  const { stdout } = await actionsExec.getExecOutput("sw_vers", undefined, {
    silent: true,
  });

  const version = stdout.match(/ProductVersion:\s*(.+)/)?.[1] ?? "";
  const name = stdout.match(/ProductName:\s*(.+)/)?.[1] ?? "";

  return {
    name,
    version,
  };
}

// Get the name and version of the current Linux system.
async function getLinuxInfo(): Promise<SystemInfo> {
  let data: object = {};

  try {
    data = releaseInfo({ mode: "sync" });
    actionsCore.debug(`Identified release info: ${JSON.stringify(data)}`);
  } catch (e: unknown) {
    actionsCore.debug(`Error collecting release info: ${e}`);
  }

  return {
    name: getPropertyViaWithDefault(
      data,
      ["id", "name", "pretty_name", "id_like"],
      "unknown",
    ),
    version: getPropertyViaWithDefault(
      data,
      ["version_id", "version", "version_codename"],
      "unknown",
    ),
  };
}

function getPropertyViaWithDefault<T, Property extends string>(
  data: object,
  names: Property[],
  defaultValue: T,
): T {
  for (const name of names) {
    const ret: T = getPropertyWithDefault(data, name, defaultValue);

    if (ret !== defaultValue) {
      return ret;
    }
  }

  return defaultValue;
}

function getPropertyWithDefault<T, Property extends string>(
  data: object,
  name: Property,
  defaultValue: T,
): T {
  if (!data.hasOwnProperty(name)) {
    return defaultValue;
  }

  const value = (data as { [K in Property]: T })[name];

  // NB. this check won't work for object instances
  if (typeof value !== typeof defaultValue) {
    return defaultValue;
  }

  return value;
}

/**
 * The Action runner's platform.
 */
const platform = os.platform();

// Whether the Action runner is a Windows system.
const isWindows = platform === "win32";

// Whether the Action runner is a macOS system.
const isMacOS = platform === "darwin";

// System-level information about the current host (platform, architecture, etc.).
export type SystemDetails = {
  name: string;
  version: string;
};

// Get system-level information about the current host (platform, architecture, etc.).
export async function getDetails(): Promise<SystemDetails> {
  return {
    ...(await (isWindows
      ? getWindowsInfo()
      : isMacOS
        ? getMacOsInfo()
        : getLinuxInfo())),
  };
}

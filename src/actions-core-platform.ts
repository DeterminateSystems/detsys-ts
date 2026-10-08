import os from "node:os";

import * as actionsCore from "@actions/core";
import * as exec from "@actions/exec";

// MIT, mostly lifted from https://github.com/actions/toolkit/blob/5a736647a123ecf8582376bdaee833fbae5b3847/packages/core/src/platform.ts
// since it isn't in @actions/core 1.10.1 which is their current release as 2024-04-19.
// Changes: Replaced the lsb_release call in Linux with `linux-release-info` to parse the os-release file directly.
import { releaseInfo } from "./linux-release-info.js";

/** The name and version of the Action runner's system. */
interface SystemInfo {
  name: string;
  version: string;
}

/** Get the name and version of the current Windows system. */
const getWindowsInfo = async (): Promise<SystemInfo> => {
  const { stdout: version } = await exec.getExecOutput(
    'powershell -command "(Get-CimInstance -ClassName Win32_OperatingSystem).Version"',
    undefined,
    {
      silent: true,
    },
  );

  const { stdout: name } = await exec.getExecOutput(
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
};

/** Get the name and version of the current macOS system. */
const getMacOsInfo = async (): Promise<SystemInfo> => {
  const { stdout } = await exec.getExecOutput("sw_vers", undefined, {
    silent: true,
  });

  const version = stdout.match(/ProductVersion:\s*(.+)/)?.[1] ?? "";
  const name = stdout.match(/ProductName:\s*(.+)/)?.[1] ?? "";

  return {
    name,
    version,
  };
};

/** Get the name and version of the current Linux system. */
const getLinuxInfo = async (): Promise<SystemInfo> => {
  let data: object = {};

  try {
    data = releaseInfo({ mode: "sync" });
    actionsCore.debug(`Identified release info: ${JSON.stringify(data)}`);
  } catch (e) {
    actionsCore.debug(`Error collecting release info: ${e}`);
  }

  return {
    name: getPropertyViaWithDefault(data, ["id", "name", "pretty_name", "id_like"], "unknown"),
    version: getPropertyViaWithDefault(
      data,
      ["version_id", "version", "version_codename"],
      "unknown",
    ),
  };
};

function getPropertyViaWithDefault<T>(data: object, names: readonly string[], defaultValue: T): T {
  for (const name of names) {
    const ret: T = getPropertyWithDefault(data, name, defaultValue);

    if (ret !== defaultValue) {
      return ret;
    }
  }

  return defaultValue;
}

function getPropertyWithDefault<T>(data: object, name: string, defaultValue: T): T {
  if (!Object.hasOwn(data, name)) {
    return defaultValue;
  }

  const value = (data as Record<string, T>)[name];

  // NB. this check won't work for object instances
  if (typeof value !== typeof defaultValue) {
    return defaultValue;
  }

  return value;
}

/** The Action runner's platform. */
export const platform = os.platform();

/** The Action runner's architecture. */
export const arch = os.arch();

/** Whether the Action runner is a Windows system. */
export const isWindows = platform === "win32";

/** Whether the Action runner is a macOS system. */
export const isMacOS = platform === "darwin";

/** Whether the Action runner is a Linux system. */
export const isLinux = platform === "linux";

/** System-level information about the current host (platform, architecture, etc.). */
interface SystemDetails {
  name: string;
  platform: string;
  arch: string;
  version: string;
  isWindows: boolean;
  isMacOS: boolean;
  isLinux: boolean;
}

/** Get system-level information about the current host (platform, architecture, etc.). */
export async function getDetails(): Promise<SystemDetails> {
  let info: Promise<SystemInfo>;
  if (isWindows) {
    info = getWindowsInfo();
  } else if (isMacOS) {
    info = getMacOsInfo();
  } else {
    info = getLinuxInfo();
  }

  return {
    ...(await info),
    platform,
    arch,
    isWindows,
    isMacOS,
    isLinux,
  };
}

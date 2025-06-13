/*!
 * linux-release-info
 * Get Linux release info (distribution name, version, arch, release, etc.)
 * from '/etc/os-release' or '/usr/lib/os-release' files and from native os
 * module. On Windows and Darwin platforms it only returns common node os module
 * info (platform, hostname, release, and arch)
 *
 * Licensed under MIT
 * Copyright (c) 2018-2020 [Samuel Carreira]
 */
// NOTE: we depend on this directly to get around some un-fun issues with mixing CommonJS
// and ESM in the bundle. We've modified the original logic to improve things like typing
// and fixing ESLint issues. Originally drawn from:
// https://github.com/samuelcarreira/linux-release-info/blob/84a91aa5442b47900da03020c590507545d3dc74/src/index.ts
import * as fs from "node:fs";
import * as os from "node:os";
import { promisify } from "node:util";
import * as actionsCore from "@actions/core";
import { stringifyError } from "./errors.js";

const readFileAsync = promisify(fs.readFile);

export interface LinuxReleaseInfoOptions {
  /**
   * read mode, possible values: 'async' and 'sync'
   *
   * @default 'async'
   */
  mode?: "async" | "sync";
  /**
   * custom complete file path with os info default null/none
   * if not provided the system will search on the '/etc/os-release'
   * and  '/usr/lib/os-release' files
   *
   * @default null
   */
  customFile?: string | null | undefined;
  /**
   * if true, show console debug messages
   *
   * @default false
   */
  debug?: boolean;
}

const linuxReleaseInfoOptionsDefaults: LinuxReleaseInfoOptions = {
  mode: "async",
  customFile: null,
  debug: false,
};

/**
 * Get OS release info from 'os-release' file and from native os module
 * on Windows or Darwin it only returns common os module info
 * (uses native fs module)
 * @returns {object} info from the current os
 */
export function releaseInfo(infoOptions: LinuxReleaseInfoOptions): object {
  const options = { ...linuxReleaseInfoOptionsDefaults, ...infoOptions };

  const searchOsReleaseFileList: string[] = osReleaseFileList(
    options.customFile,
  );

  if (os.type() !== "Linux") {
    if (options.mode === "sync") {
      return getOsInfo();
    } else {
      return Promise.resolve(getOsInfo());
    }
  }

  if (options.mode === "sync") {
    return readSyncOsreleaseFile(searchOsReleaseFileList, options);
  } else {
    return Promise.resolve(
      readAsyncOsReleaseFile(searchOsReleaseFileList, options),
    );
  }
}

/**
 * Format file data: convert data to object keys/values
 *
 * @param {object} sourceData Source object to be appended
 * @param {string} srcParseData Input file data to be parsed
 * @returns {object} Formated object
 */
function formatFileData(sourceData: OsInfo, srcParseData: string): OsInfo {
  const lines: string[] = srcParseData.split("\n");

  for (const line of lines) {
    const lineData = line.split("=");

    if (lineData.length === 2) {
      lineData[1] = lineData[1].replace(/["'\r]/gi, ""); // remove quotes and return character

      Object.defineProperty(sourceData, lineData[0].toLowerCase(), {
        value: lineData[1],
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
  }

  return sourceData;
}

/**
 * Export a list of os-release files
 *
 * @param {string} customFile optional custom complete filepath
 * @returns {array} list of os-release files
 */
function osReleaseFileList(customFile: string | null | undefined): string[] {
  const DefaultOsReleaseFiles = ["/etc/os-release", "/usr/lib/os-release"];

  if (!customFile) {
    return DefaultOsReleaseFiles;
  } else {
    return Array(customFile);
  }
}

/**
 * Operating system info.
 */
type OsInfo = {
  type: string;
  platform: string;
  hostname: string;
  arch: string;
  release: string;
};

/**
 * Get OS Basic Info
 * (uses node 'os' native module)
 *
 * @returns {OsInfo} os basic info
 */
function getOsInfo(): OsInfo {
  return {
    type: os.type(),
    platform: os.platform(),
    hostname: os.hostname(),
    arch: os.arch(),
    release: os.release(),
  };
}

/* Helper functions */

async function readAsyncOsReleaseFile(
  fileList: string[],
  options: LinuxReleaseInfoOptions,
): Promise<OsInfo> {
  let fileData = null;

  for (const osReleaseFile of fileList) {
    try {
      if (options.debug) {
        actionsCore.info(`Trying to read '${osReleaseFile}'...`);
      }

      fileData = await readFileAsync(osReleaseFile, "binary");

      if (options.debug) {
        actionsCore.info(`Read data:\n${fileData}`);
      }

      break;
    } catch (error) {
      if (options.debug) {
        actionsCore.error(stringifyError(error));
      }
    }
  }

  if (fileData === null) {
    throw new Error("Cannot read os-release file!");
    //return getOsInfo();
  }

  return formatFileData(getOsInfo(), fileData);
}

function readSyncOsreleaseFile(
  releaseFileList: string[],
  options: LinuxReleaseInfoOptions,
): OsInfo {
  let fileData = null;

  for (const osReleaseFile of releaseFileList) {
    try {
      if (options.debug) {
        actionsCore.info(`Trying to read '${osReleaseFile}'...`);
      }

      fileData = fs.readFileSync(osReleaseFile, "binary");

      if (options.debug) {
        actionsCore.info(`Read data:\n${fileData}`);
      }

      break;
    } catch (error: unknown) {
      if (options.debug) {
        actionsCore.error(stringifyError(error));
      }
    }
  }

  if (fileData === null) {
    throw new Error("Cannot read os-release file!");
    //return getOsInfo();
  }

  return formatFileData(getOsInfo(), fileData);
}

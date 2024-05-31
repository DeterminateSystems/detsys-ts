var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// package.json
var version = "1.0.0";

// src/linux-release-info.ts
import * as fs from "node:fs";
import * as os from "node:os";
import { promisify } from "node:util";
var readFileAsync = promisify(fs.readFile);
var linuxReleaseInfoOptionsDefaults = {
  mode: "async",
  customFile: null,
  debug: false
};
function releaseInfo(infoOptions) {
  const options = { ...linuxReleaseInfoOptionsDefaults, ...infoOptions };
  const searchOsReleaseFileList = osReleaseFileList(
    options.customFile
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
      readAsyncOsReleaseFile(searchOsReleaseFileList, options)
    );
  }
}
function formatFileData(sourceData, srcParseData) {
  const lines = srcParseData.split("\n");
  for (const line of lines) {
    const lineData = line.split("=");
    if (lineData.length === 2) {
      lineData[1] = lineData[1].replace(/["'\r]/gi, "");
      Object.defineProperty(sourceData, lineData[0].toLowerCase(), {
        value: lineData[1],
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
  }
  return sourceData;
}
function osReleaseFileList(customFile) {
  const DEFAULT_OS_RELEASE_FILES = ["/etc/os-release", "/usr/lib/os-release"];
  if (!customFile) {
    return DEFAULT_OS_RELEASE_FILES;
  } else {
    return Array(customFile);
  }
}
function getOsInfo() {
  return {
    type: os.type(),
    platform: os.platform(),
    hostname: os.hostname(),
    arch: os.arch(),
    release: os.release()
  };
}
async function readAsyncOsReleaseFile(fileList, options) {
  let fileData = null;
  for (const osReleaseFile of fileList) {
    try {
      if (options.debug) {
        console.log(`Trying to read '${osReleaseFile}'...`);
      }
      fileData = await readFileAsync(osReleaseFile, "binary");
      if (options.debug) {
        console.log(`Read data:
${fileData}`);
      }
      break;
    } catch (error3) {
      if (options.debug) {
        console.error(error3);
      }
    }
  }
  if (fileData === null) {
    throw new Error("Cannot read os-release file!");
  }
  return formatFileData(getOsInfo(), fileData);
}
function readSyncOsreleaseFile(releaseFileList, options) {
  let fileData = null;
  for (const osReleaseFile of releaseFileList) {
    try {
      if (options.debug) {
        console.log(`Trying to read '${osReleaseFile}'...`);
      }
      fileData = fs.readFileSync(osReleaseFile, "binary");
      if (options.debug) {
        console.log(`Read data:
${fileData}`);
      }
      break;
    } catch (error3) {
      if (options.debug) {
        console.error(error3);
      }
    }
  }
  if (fileData === null) {
    throw new Error("Cannot read os-release file!");
  }
  return formatFileData(getOsInfo(), fileData);
}

// src/actions-core-platform.ts
import * as actionsCore from "@actions/core";
import * as exec from "@actions/exec";
import os2 from "os";
var getWindowsInfo = async () => {
  const { stdout: version2 } = await exec.getExecOutput(
    'powershell -command "(Get-CimInstance -ClassName Win32_OperatingSystem).Version"',
    void 0,
    {
      silent: true
    }
  );
  const { stdout: name } = await exec.getExecOutput(
    'powershell -command "(Get-CimInstance -ClassName Win32_OperatingSystem).Caption"',
    void 0,
    {
      silent: true
    }
  );
  return {
    name: name.trim(),
    version: version2.trim()
  };
};
var getMacOsInfo = async () => {
  const { stdout } = await exec.getExecOutput("sw_vers", void 0, {
    silent: true
  });
  const version2 = stdout.match(/ProductVersion:\s*(.+)/)?.[1] ?? "";
  const name = stdout.match(/ProductName:\s*(.+)/)?.[1] ?? "";
  return {
    name,
    version: version2
  };
};
var getLinuxInfo = async () => {
  let data = {};
  try {
    data = releaseInfo({ mode: "sync" });
    actionsCore.debug(`Identified release info: ${JSON.stringify(data)}`);
  } catch (e) {
    actionsCore.debug(`Error collecting release info: ${e}`);
  }
  return {
    name: getPropertyViaWithDefault(
      data,
      ["id", "name", "pretty_name", "id_like"],
      "unknown"
    ),
    version: getPropertyViaWithDefault(
      data,
      ["version_id", "version", "version_codename"],
      "unknown"
    )
  };
};
function getPropertyViaWithDefault(data, names, defaultValue) {
  for (const name of names) {
    const ret = getPropertyWithDefault(data, name, defaultValue);
    if (ret !== defaultValue) {
      return ret;
    }
  }
  return defaultValue;
}
function getPropertyWithDefault(data, name, defaultValue) {
  if (!data.hasOwnProperty(name)) {
    return defaultValue;
  }
  const value = data[name];
  if (typeof value !== typeof defaultValue) {
    return defaultValue;
  }
  return value;
}
var platform2 = os2.platform();
var arch2 = os2.arch();
var isWindows = platform2 === "win32";
var isMacOS = platform2 === "darwin";
var isLinux = platform2 === "linux";
async function getDetails() {
  return {
    ...await (isWindows ? getWindowsInfo() : isMacOS ? getMacOsInfo() : getLinuxInfo()),
    platform: platform2,
    arch: arch2,
    isWindows,
    isMacOS,
    isLinux
  };
}

// src/correlation.ts
import * as actionsCore2 from "@actions/core";
import { createHash } from "node:crypto";
var OPTIONAL_VARIABLES = ["INVOCATION_ID"];
function identify(projectName) {
  const ident = {
    correlation_source: "github-actions",
    repository: hashEnvironmentVariables("GHR", [
      "GITHUB_SERVER_URL",
      "GITHUB_REPOSITORY_OWNER",
      "GITHUB_REPOSITORY_OWNER_ID",
      "GITHUB_REPOSITORY",
      "GITHUB_REPOSITORY_ID"
    ]),
    workflow: hashEnvironmentVariables("GHW", [
      "GITHUB_SERVER_URL",
      "GITHUB_REPOSITORY_OWNER",
      "GITHUB_REPOSITORY_OWNER_ID",
      "GITHUB_REPOSITORY",
      "GITHUB_REPOSITORY_ID",
      "GITHUB_WORKFLOW"
    ]),
    job: hashEnvironmentVariables("GHWJ", [
      "GITHUB_SERVER_URL",
      "GITHUB_REPOSITORY_OWNER",
      "GITHUB_REPOSITORY_OWNER_ID",
      "GITHUB_REPOSITORY",
      "GITHUB_REPOSITORY_ID",
      "GITHUB_WORKFLOW",
      "GITHUB_JOB"
    ]),
    run: hashEnvironmentVariables("GHWJR", [
      "GITHUB_SERVER_URL",
      "GITHUB_REPOSITORY_OWNER",
      "GITHUB_REPOSITORY_OWNER_ID",
      "GITHUB_REPOSITORY",
      "GITHUB_REPOSITORY_ID",
      "GITHUB_WORKFLOW",
      "GITHUB_JOB",
      "GITHUB_RUN_ID"
    ]),
    run_differentiator: hashEnvironmentVariables("GHWJA", [
      "GITHUB_SERVER_URL",
      "GITHUB_REPOSITORY_OWNER",
      "GITHUB_REPOSITORY_OWNER_ID",
      "GITHUB_REPOSITORY",
      "GITHUB_REPOSITORY_ID",
      "GITHUB_WORKFLOW",
      "GITHUB_JOB",
      "GITHUB_RUN_ID",
      "GITHUB_RUN_NUMBER",
      "GITHUB_RUN_ATTEMPT",
      "INVOCATION_ID"
    ]),
    groups: {
      ci: "github-actions",
      project: projectName,
      github_organization: hashEnvironmentVariables("GHO", [
        "GITHUB_SERVER_URL",
        "GITHUB_REPOSITORY_OWNER",
        "GITHUB_REPOSITORY_OWNER_ID"
      ])
    }
  };
  actionsCore2.debug("Correlation data:");
  actionsCore2.debug(JSON.stringify(ident, null, 2));
  return ident;
}
function hashEnvironmentVariables(prefix, variables) {
  const hash = createHash("sha256");
  for (const varName of variables) {
    let value = process.env[varName];
    if (value === void 0) {
      if (OPTIONAL_VARIABLES.includes(varName)) {
        actionsCore2.debug(
          `Optional environment variable not set: ${varName} -- substituting with the variable name`
        );
        value = varName;
      } else {
        actionsCore2.debug(
          `Environment variable not set: ${varName} -- can't generate the requested identity`
        );
        return void 0;
      }
    }
    hash.update(value);
    hash.update("\0");
  }
  return `${prefix}-${hash.digest("hex")}`;
}

// src/errors.ts
function stringifyError(e) {
  if (e instanceof Error) {
    return e.message;
  } else if (typeof e === "string") {
    return e;
  } else {
    return JSON.stringify(e);
  }
}

// src/ids-host.ts
import * as actionsCore3 from "@actions/core";
import { resolveSrv } from "node:dns/promises";
var DEFAULT_LOOKUP = "_detsys_ids._tcp.install.determinate.systems.";
var ALLOWED_SUFFIXES = [
  ".install.determinate.systems",
  ".install.detsys.dev"
];
var DEFAULT_IDS_HOST = "https://install.determinate.systems";
var LOOKUP = process.env["IDS_LOOKUP"] ?? DEFAULT_LOOKUP;
var IdsHost = class {
  constructor(idsProjectName, diagnosticsSuffix, runtimeDiagnosticsUrl) {
    this.idsProjectName = idsProjectName;
    this.diagnosticsSuffix = diagnosticsSuffix;
    this.runtimeDiagnosticsUrl = runtimeDiagnosticsUrl;
  }
  async getRootUrl() {
    const idsHost = process.env["IDS_HOST"];
    if (idsHost !== void 0) {
      try {
        return new URL(idsHost);
      } catch (err) {
        actionsCore3.error(
          `IDS_HOST environment variable is not a valid URL. Ignoring. ${stringifyError(err)}`
        );
      }
    }
    let url = void 0;
    try {
      const urls = await this.getUrlsByPreference();
      url = urls[0];
    } catch (err) {
      actionsCore3.error(
        `Error collecting IDS URLs by preference: ${stringifyError(err)}`
      );
    }
    if (url === void 0) {
      url = new URL(DEFAULT_IDS_HOST);
    }
    return url;
  }
  async getDiagnosticsUrl() {
    if (this.runtimeDiagnosticsUrl === "") {
      return void 0;
    }
    if (this.runtimeDiagnosticsUrl !== void 0) {
      try {
        return new URL(this.runtimeDiagnosticsUrl);
      } catch (err) {
        actionsCore3.info(
          `User-provided diagnostic endpoint ignored: not a valid URL: ${stringifyError(err)}`
        );
      }
    }
    try {
      const diagnosticUrl = await this.getRootUrl();
      diagnosticUrl.pathname += this.idsProjectName;
      diagnosticUrl.pathname += "/";
      diagnosticUrl.pathname += this.diagnosticsSuffix || "diagnostics";
      return diagnosticUrl;
    } catch (err) {
      actionsCore3.info(
        `Generated diagnostic endpoint ignored, and diagnostics are disabled: not a valid URL: ${stringifyError(err)}`
      );
      return void 0;
    }
  }
  async getUrlsByPreference() {
    if (this.prioritizedURLs === void 0) {
      this.prioritizedURLs = orderRecordsByPriorityWeight(
        await discoverServiceRecords()
      ).flatMap((record) => recordToUrl(record) || []);
    }
    return this.prioritizedURLs;
  }
};
function recordToUrl(record) {
  const urlStr = `https://${record.name}:${record.port}`;
  try {
    return new URL(urlStr);
  } catch (err) {
    actionsCore3.debug(
      `Record ${JSON.stringify(record)} produced an invalid URL: ${urlStr} (${err})`
    );
    return void 0;
  }
}
async function discoverServiceRecords() {
  return await discoverServicesStub(resolveSrv(LOOKUP), 1e3);
}
async function discoverServicesStub(lookup, timeout) {
  const defaultFallback = new Promise(
    (resolve, _reject) => {
      setTimeout(resolve, timeout, []);
    }
  );
  let records;
  try {
    records = await Promise.race([lookup, defaultFallback]);
  } catch (reason) {
    actionsCore3.debug(`Error resolving SRV records: ${stringifyError(reason)}`);
    records = [];
  }
  const acceptableRecords = records.filter((record) => {
    for (const suffix of ALLOWED_SUFFIXES) {
      if (record.name.endsWith(suffix)) {
        return true;
      }
    }
    actionsCore3.debug(
      `Unacceptable domain due to an invalid suffix: ${record.name}`
    );
    return false;
  });
  if (acceptableRecords.length === 0) {
    actionsCore3.debug(`No records found for ${LOOKUP}`);
  } else {
    actionsCore3.debug(
      `Resolved ${LOOKUP} to ${JSON.stringify(acceptableRecords)}`
    );
  }
  return acceptableRecords;
}
function orderRecordsByPriorityWeight(records) {
  const byPriorityWeight = /* @__PURE__ */ new Map();
  for (const record of records) {
    const existing = byPriorityWeight.get(record.priority);
    if (existing) {
      existing.push(record);
    } else {
      byPriorityWeight.set(record.priority, [record]);
    }
  }
  const prioritizedRecords = [];
  const keys = Array.from(byPriorityWeight.keys()).sort(
    (a, b) => a - b
  );
  for (const priority of keys) {
    const recordsByPrio = byPriorityWeight.get(priority);
    if (recordsByPrio === void 0) {
      continue;
    }
    prioritizedRecords.push(...weightedRandom(recordsByPrio));
  }
  return prioritizedRecords;
}
function weightedRandom(records) {
  const scratchRecords = records.slice();
  const result = [];
  while (scratchRecords.length > 0) {
    const weights = [];
    {
      for (let i = 0; i < scratchRecords.length; i++) {
        weights.push(
          scratchRecords[i].weight + (i > 0 ? scratchRecords[i - 1].weight : 0)
        );
      }
    }
    const point = Math.random() * weights[weights.length - 1];
    for (let selectedIndex = 0; selectedIndex < weights.length; selectedIndex++) {
      if (weights[selectedIndex] > point) {
        result.push(scratchRecords.splice(selectedIndex, 1)[0]);
        break;
      }
    }
  }
  return result;
}

// src/inputs.ts
var inputs_exports = {};
__export(inputs_exports, {
  getArrayOfStrings: () => getArrayOfStrings,
  getArrayOfStringsOrNull: () => getArrayOfStringsOrNull,
  getBool: () => getBool,
  getMultilineStringOrNull: () => getMultilineStringOrNull,
  getNumberOrNull: () => getNumberOrNull,
  getString: () => getString,
  getStringOrNull: () => getStringOrNull,
  getStringOrUndefined: () => getStringOrUndefined,
  handleString: () => handleString
});
import * as actionsCore4 from "@actions/core";
var getBool = (name) => {
  return actionsCore4.getBooleanInput(name);
};
var getArrayOfStrings = (name, separator) => {
  const original = getString(name);
  return handleString(original, separator);
};
var getArrayOfStringsOrNull = (name, separator) => {
  const original = getStringOrNull(name);
  if (original === null) {
    return null;
  } else {
    return handleString(original, separator);
  }
};
var handleString = (input, separator) => {
  const sepChar = separator === "comma" ? "," : /\s+/;
  const trimmed = input.trim();
  if (trimmed === "") {
    return [];
  }
  return trimmed.split(sepChar).map((s) => s.trim());
};
var getMultilineStringOrNull = (name) => {
  const value = actionsCore4.getMultilineInput(name);
  if (value.length === 0) {
    return null;
  } else {
    return value;
  }
};
var getNumberOrNull = (name) => {
  const value = actionsCore4.getInput(name);
  if (value === "") {
    return null;
  } else {
    return Number(value);
  }
};
var getString = (name) => {
  return actionsCore4.getInput(name);
};
var getStringOrNull = (name) => {
  const value = actionsCore4.getInput(name);
  if (value === "") {
    return null;
  } else {
    return value;
  }
};
var getStringOrUndefined = (name) => {
  const value = actionsCore4.getInput(name);
  if (value === "") {
    return void 0;
  } else {
    return value;
  }
};

// src/platform.ts
var platform_exports = {};
__export(platform_exports, {
  getArchOs: () => getArchOs,
  getNixPlatform: () => getNixPlatform
});
import * as actionsCore5 from "@actions/core";
function getArchOs() {
  const envArch = process.env.RUNNER_ARCH;
  const envOs = process.env.RUNNER_OS;
  if (envArch && envOs) {
    return `${envArch}-${envOs}`;
  } else {
    actionsCore5.error(
      `Can't identify the platform: RUNNER_ARCH or RUNNER_OS undefined (${envArch}-${envOs})`
    );
    throw new Error("RUNNER_ARCH and/or RUNNER_OS is not defined");
  }
}
function getNixPlatform(archOs) {
  const archOsMap = /* @__PURE__ */ new Map([
    ["X64-macOS", "x86_64-darwin"],
    ["ARM64-macOS", "aarch64-darwin"],
    ["X64-Linux", "x86_64-linux"],
    ["ARM64-Linux", "aarch64-linux"]
  ]);
  const mappedTo = archOsMap.get(archOs);
  if (mappedTo) {
    return mappedTo;
  } else {
    actionsCore5.error(
      `ArchOs (${archOs}) doesn't map to a supported Nix platform.`
    );
    throw new Error(
      `Cannot convert ArchOs (${archOs}) to a supported Nix platform.`
    );
  }
}

// src/sourcedef.ts
import * as actionsCore6 from "@actions/core";
function constructSourceParameters(legacyPrefix) {
  return {
    path: noisilyGetInput("path", legacyPrefix),
    url: noisilyGetInput("url", legacyPrefix),
    tag: noisilyGetInput("tag", legacyPrefix),
    pr: noisilyGetInput("pr", legacyPrefix),
    branch: noisilyGetInput("branch", legacyPrefix),
    revision: noisilyGetInput("revision", legacyPrefix)
  };
}
function noisilyGetInput(suffix, legacyPrefix) {
  const preferredInput = getStringOrUndefined(`source-${suffix}`);
  if (!legacyPrefix) {
    return preferredInput;
  }
  const legacyInput = getStringOrUndefined(`${legacyPrefix}-${suffix}`);
  if (preferredInput && legacyInput) {
    actionsCore6.warning(
      `The supported option source-${suffix} and the legacy option ${legacyPrefix}-${suffix} are both set. Preferring source-${suffix}. Please stop setting ${legacyPrefix}-${suffix}.`
    );
    return preferredInput;
  } else if (legacyInput) {
    actionsCore6.warning(
      `The legacy option ${legacyPrefix}-${suffix} is set. Please migrate to source-${suffix}.`
    );
    return legacyInput;
  } else {
    return preferredInput;
  }
}

// src/index.ts
import * as actionsCache from "@actions/cache";
import * as actionsCore7 from "@actions/core";
import * as actionsExec from "@actions/exec";
import got from "got";
import { exec as exec3 } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream, readFileSync as readFileSync2 } from "node:fs";
import fs2, { chmod, copyFile, mkdir } from "node:fs/promises";
import * as os3 from "node:os";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify as promisify2 } from "node:util";
import { gzip } from "node:zlib";
var EVENT_EXCEPTION = "exception";
var EVENT_ARTIFACT_CACHE_HIT = "artifact_cache_hit";
var EVENT_ARTIFACT_CACHE_MISS = "artifact_cache_miss";
var EVENT_ARTIFACT_CACHE_PERSIST = "artifact_cache_persist";
var EVENT_PREFLIGHT_REQUIRE_NIX_DENIED = "preflight-require-nix-denied";
var FACT_ARTIFACT_FETCHED_FROM_CACHE = "artifact_fetched_from_cache";
var FACT_ENDED_WITH_EXCEPTION = "ended_with_exception";
var FACT_FINAL_EXCEPTION = "final_exception";
var FACT_OS = "$os";
var FACT_OS_VERSION = "$os_version";
var FACT_SOURCE_URL = "source_url";
var FACT_SOURCE_URL_ETAG = "source_url_etag";
var FACT_NIX_LOCATION = "nix_location";
var FACT_NIX_STORE_TRUST = "nix_store_trusted";
var FACT_NIX_STORE_VERSION = "nix_store_version";
var FACT_NIX_STORE_CHECK_METHOD = "nix_store_check_method";
var FACT_NIX_STORE_CHECK_ERROR = "nix_store_check_error";
var STATE_KEY_EXECUTION_PHASE = "detsys_action_execution_phase";
var STATE_KEY_NIX_NOT_FOUND = "detsys_action_nix_not_found";
var STATE_NOT_FOUND = "not-found";
var DIAGNOSTIC_ENDPOINT_TIMEOUT_MS = 3e4;
var DetSysAction = class {
  determineExecutionPhase() {
    const currentPhase = actionsCore7.getState(STATE_KEY_EXECUTION_PHASE);
    if (currentPhase === "") {
      actionsCore7.saveState(STATE_KEY_EXECUTION_PHASE, "post");
      return "main";
    } else {
      return "post";
    }
  }
  constructor(actionOptions) {
    this.actionOptions = makeOptionsConfident(actionOptions);
    this.idsHost = new IdsHost(
      this.actionOptions.idsProjectName,
      actionOptions.diagnosticsSuffix,
      process.env["INPUT_DIAGNOSTIC-ENDPOINT"]
    );
    this.exceptionAttachments = /* @__PURE__ */ new Map();
    this.nixStoreTrust = "unknown";
    this.strictMode = getBool("_internal-strict-mode");
    this.events = [];
    this.client = got.extend({
      retry: {
        limit: 3,
        methods: ["GET", "HEAD"]
      },
      hooks: {
        beforeRetry: [
          (error3, retryCount) => {
            actionsCore7.info(
              `Retrying after error ${error3.code}, retry #: ${retryCount}`
            );
          }
        ]
      }
    });
    this.facts = {
      $lib: "idslib",
      $lib_version: version,
      project: this.actionOptions.name,
      ids_project: this.actionOptions.idsProjectName
    };
    const params = [
      ["github_action_ref", "GITHUB_ACTION_REF"],
      ["github_action_repository", "GITHUB_ACTION_REPOSITORY"],
      ["github_event_name", "GITHUB_EVENT_NAME"],
      ["$os", "RUNNER_OS"],
      ["arch", "RUNNER_ARCH"]
    ];
    for (const [target, env] of params) {
      const value = process.env[env];
      if (value) {
        this.facts[target] = value;
      }
    }
    this.identity = identify(this.actionOptions.name);
    this.archOs = getArchOs();
    this.nixSystem = getNixPlatform(this.archOs);
    this.facts.arch_os = this.archOs;
    this.facts.nix_system = this.nixSystem;
    {
      getDetails().then((details) => {
        if (details.name !== "unknown") {
          this.addFact(FACT_OS, details.name);
        }
        if (details.version !== "unknown") {
          this.addFact(FACT_OS_VERSION, details.version);
        }
      }).catch((e) => {
        actionsCore7.debug(
          `Failure getting platform details: ${stringifyError2(e)}`
        );
      });
    }
    this.executionPhase = this.determineExecutionPhase();
    this.facts.execution_phase = this.executionPhase;
    if (this.actionOptions.fetchStyle === "gh-env-style") {
      this.architectureFetchSuffix = this.archOs;
    } else if (this.actionOptions.fetchStyle === "nix-style") {
      this.architectureFetchSuffix = this.nixSystem;
    } else if (this.actionOptions.fetchStyle === "universal") {
      this.architectureFetchSuffix = "universal";
    } else {
      throw new Error(
        `fetchStyle ${this.actionOptions.fetchStyle} is not a valid style`
      );
    }
    this.sourceParameters = constructSourceParameters(
      this.actionOptions.legacySourcePrefix
    );
    this.recordEvent(`begin_${this.executionPhase}`);
  }
  /**
   * Attach a file to the diagnostics data in error conditions.
   *
   * The file at `location` doesn't need to exist when stapleFile is called.
   *
   * If the file doesn't exist or is unreadable when trying to staple the attachments, the JS error will be stored in a context value at `staple_failure_{name}`.
   * If the file is readable, the file's contents will be stored in a context value at `staple_value_{name}`.
   */
  stapleFile(name, location) {
    this.exceptionAttachments.set(name, location);
  }
  /**
   * Execute the Action as defined.
   */
  execute() {
    this.executeAsync().catch((error3) => {
      console.log(error3);
      process.exitCode = 1;
    });
  }
  getTemporaryName() {
    const tmpDir = process.env["RUNNER_TEMP"] || tmpdir();
    return path.join(tmpDir, `${this.actionOptions.name}-${randomUUID()}`);
  }
  addFact(key, value) {
    this.facts[key] = value;
  }
  async getDiagnosticsUrl() {
    return await this.idsHost.getDiagnosticsUrl();
  }
  getUniqueId() {
    return this.identity.run_differentiator || process.env.RUNNER_TRACKING_ID || randomUUID();
  }
  getCorrelationHashes() {
    return this.identity;
  }
  recordEvent(eventName, context = {}) {
    this.events.push({
      event_name: `${this.actionOptions.eventPrefix}${eventName}`,
      context,
      correlation: this.identity,
      facts: this.facts,
      timestamp: /* @__PURE__ */ new Date(),
      uuid: randomUUID()
    });
  }
  /**
   * Unpacks the closure returned by `fetchArtifact()`, imports the
   * contents into the Nix store, and returns the path of the executable at
   * `/nix/store/STORE_PATH/bin/${bin}`.
   */
  async unpackClosure(bin) {
    const artifact = await this.fetchArtifact();
    const { stdout } = await promisify2(exec3)(
      `cat "${artifact}" | xz -d | nix-store --import`
    );
    const paths = stdout.split(os3.EOL);
    const lastPath = paths.at(-2);
    return `${lastPath}/bin/${bin}`;
  }
  /**
   * Fetches the executable at the URL determined by the `source-*` inputs and
   * other facts, `chmod`s it, and returns the path to the executable on disk.
   */
  async fetchExecutable() {
    const binaryPath = await this.fetchArtifact();
    await chmod(binaryPath, fs2.constants.S_IXUSR | fs2.constants.S_IXGRP);
    return binaryPath;
  }
  get isMain() {
    return this.executionPhase === "main";
  }
  get isPost() {
    return this.executionPhase === "post";
  }
  async executeAsync() {
    try {
      process.env.DETSYS_CORRELATION = JSON.stringify(
        this.getCorrelationHashes()
      );
      if (!await this.preflightRequireNix()) {
        this.recordEvent(EVENT_PREFLIGHT_REQUIRE_NIX_DENIED);
        return;
      } else {
        await this.preflightNixStoreInfo();
        this.addFact(FACT_NIX_STORE_TRUST, this.nixStoreTrust);
      }
      if (this.isMain) {
        await this.main();
      } else if (this.isPost) {
        await this.post();
      }
      this.addFact(FACT_ENDED_WITH_EXCEPTION, false);
    } catch (e) {
      this.addFact(FACT_ENDED_WITH_EXCEPTION, true);
      const reportable = stringifyError2(e);
      this.addFact(FACT_FINAL_EXCEPTION, reportable);
      if (this.isPost) {
        actionsCore7.warning(reportable);
      } else {
        actionsCore7.setFailed(reportable);
      }
      const doGzip = promisify2(gzip);
      const exceptionContext = /* @__PURE__ */ new Map();
      for (const [attachmentLabel, filePath] of this.exceptionAttachments) {
        try {
          const logText = readFileSync2(filePath);
          const buf = await doGzip(logText);
          exceptionContext.set(
            `staple_value_${attachmentLabel}`,
            buf.toString("base64")
          );
        } catch (innerError) {
          exceptionContext.set(
            `staple_failure_${attachmentLabel}`,
            stringifyError2(innerError)
          );
        }
      }
      this.recordEvent(EVENT_EXCEPTION, Object.fromEntries(exceptionContext));
    } finally {
      await this.complete();
    }
  }
  /**
   * Fetch an artifact, such as a tarball, from the location determined by the
   * `source-*` inputs. If `source-binary` is specified, this will return a path
   * to a binary on disk; otherwise, the artifact will be downloaded from the
   * URL determined by the other `source-*` inputs (`source-url`, `source-pr`,
   * etc.).
   */
  async fetchArtifact() {
    const sourceBinary = getStringOrNull("source-binary");
    if (sourceBinary !== null && sourceBinary !== "") {
      actionsCore7.debug(`Using the provided source binary at ${sourceBinary}`);
      return sourceBinary;
    }
    actionsCore7.startGroup(
      `Downloading ${this.actionOptions.name} for ${this.architectureFetchSuffix}`
    );
    try {
      actionsCore7.info(`Fetching from ${await this.getSourceUrl()}`);
      const correlatedUrl = await this.getSourceUrl();
      correlatedUrl.searchParams.set("ci", "github");
      correlatedUrl.searchParams.set(
        "correlation",
        JSON.stringify(this.identity)
      );
      const versionCheckup = await this.client.head(correlatedUrl);
      if (versionCheckup.headers.etag) {
        const v = versionCheckup.headers.etag;
        this.addFact(FACT_SOURCE_URL_ETAG, v);
        actionsCore7.debug(
          `Checking the tool cache for ${await this.getSourceUrl()} at ${v}`
        );
        const cached = await this.getCachedVersion(v);
        if (cached) {
          this.facts[FACT_ARTIFACT_FETCHED_FROM_CACHE] = true;
          actionsCore7.debug(`Tool cache hit.`);
          return cached;
        }
      }
      this.facts[FACT_ARTIFACT_FETCHED_FROM_CACHE] = false;
      actionsCore7.debug(
        `No match from the cache, re-fetching from the redirect: ${versionCheckup.url}`
      );
      const destFile = this.getTemporaryName();
      const fetchStream = this.client.stream(versionCheckup.url);
      await pipeline(
        fetchStream,
        createWriteStream(destFile, {
          encoding: "binary",
          mode: 493
        })
      );
      if (fetchStream.response?.headers.etag) {
        const v = fetchStream.response.headers.etag;
        try {
          await this.saveCachedVersion(v, destFile);
        } catch (e) {
          actionsCore7.debug(`Error caching the artifact: ${stringifyError2(e)}`);
        }
      }
      return destFile;
    } finally {
      actionsCore7.endGroup();
    }
  }
  /**
   * A helper function for failing on error only if strict mode is enabled.
   * This is intended only for CI environments testing Actions themselves.
   */
  failOnError(msg) {
    if (this.strictMode) {
      actionsCore7.setFailed(`strict mode failure: ${msg}`);
    }
  }
  async complete() {
    this.recordEvent(`complete_${this.executionPhase}`);
    await this.submitEvents();
  }
  async getSourceUrl() {
    const p = this.sourceParameters;
    if (p.url) {
      this.addFact(FACT_SOURCE_URL, p.url);
      return new URL(p.url);
    }
    const fetchUrl = await this.idsHost.getRootUrl();
    fetchUrl.pathname += this.actionOptions.idsProjectName;
    if (p.tag) {
      fetchUrl.pathname += `/tag/${p.tag}`;
    } else if (p.pr) {
      fetchUrl.pathname += `/pr/${p.pr}`;
    } else if (p.branch) {
      fetchUrl.pathname += `/branch/${p.branch}`;
    } else if (p.revision) {
      fetchUrl.pathname += `/rev/${p.revision}`;
    } else {
      fetchUrl.pathname += `/stable`;
    }
    fetchUrl.pathname += `/${this.architectureFetchSuffix}`;
    this.addFact(FACT_SOURCE_URL, fetchUrl.toString());
    return fetchUrl;
  }
  cacheKey(version2) {
    const cleanedVersion = version2.replace(/[^a-zA-Z0-9-+.]/g, "");
    return `determinatesystem-${this.actionOptions.name}-${this.architectureFetchSuffix}-${cleanedVersion}`;
  }
  async getCachedVersion(version2) {
    const startCwd = process.cwd();
    try {
      const tempDir = this.getTemporaryName();
      await mkdir(tempDir);
      process.chdir(tempDir);
      process.env.GITHUB_WORKSPACE_BACKUP = process.env.GITHUB_WORKSPACE;
      delete process.env.GITHUB_WORKSPACE;
      if (await actionsCache.restoreCache(
        [this.actionOptions.name],
        this.cacheKey(version2),
        [],
        void 0,
        true
      )) {
        this.recordEvent(EVENT_ARTIFACT_CACHE_HIT);
        return `${tempDir}/${this.actionOptions.name}`;
      }
      this.recordEvent(EVENT_ARTIFACT_CACHE_MISS);
      return void 0;
    } finally {
      process.env.GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE_BACKUP;
      delete process.env.GITHUB_WORKSPACE_BACKUP;
      process.chdir(startCwd);
    }
  }
  async saveCachedVersion(version2, toolPath) {
    const startCwd = process.cwd();
    try {
      const tempDir = this.getTemporaryName();
      await mkdir(tempDir);
      process.chdir(tempDir);
      await copyFile(toolPath, `${tempDir}/${this.actionOptions.name}`);
      process.env.GITHUB_WORKSPACE_BACKUP = process.env.GITHUB_WORKSPACE;
      delete process.env.GITHUB_WORKSPACE;
      await actionsCache.saveCache(
        [this.actionOptions.name],
        this.cacheKey(version2),
        void 0,
        true
      );
      this.recordEvent(EVENT_ARTIFACT_CACHE_PERSIST);
    } finally {
      process.env.GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE_BACKUP;
      delete process.env.GITHUB_WORKSPACE_BACKUP;
      process.chdir(startCwd);
    }
  }
  async preflightRequireNix() {
    let nixLocation;
    const pathParts = (process.env["PATH"] || "").split(":");
    for (const location of pathParts) {
      const candidateNix = path.join(location, "nix");
      try {
        await fs2.access(candidateNix, fs2.constants.X_OK);
        actionsCore7.debug(`Found Nix at ${candidateNix}`);
        nixLocation = candidateNix;
        break;
      } catch {
        actionsCore7.debug(`Nix not at ${candidateNix}`);
      }
    }
    this.addFact(FACT_NIX_LOCATION, nixLocation || "");
    if (this.actionOptions.requireNix === "ignore") {
      return true;
    }
    const currentNotFoundState = actionsCore7.getState(STATE_KEY_NIX_NOT_FOUND);
    if (currentNotFoundState === STATE_NOT_FOUND) {
      return false;
    }
    if (nixLocation !== void 0) {
      return true;
    }
    actionsCore7.saveState(STATE_KEY_NIX_NOT_FOUND, STATE_NOT_FOUND);
    switch (this.actionOptions.requireNix) {
      case "fail":
        actionsCore7.setFailed(
          [
            "This action can only be used when Nix is installed.",
            "Add `- uses: DeterminateSystems/nix-installer-action@main` earlier in your workflow."
          ].join(" ")
        );
        break;
      case "warn":
        actionsCore7.warning(
          [
            "This action is in no-op mode because Nix is not installed.",
            "Add `- uses: DeterminateSystems/nix-installer-action@main` earlier in your workflow."
          ].join(" ")
        );
        break;
    }
    return false;
  }
  async preflightNixStoreInfo() {
    let output = "";
    const options = {};
    options.silent = true;
    options.listeners = {
      stdout: (data) => {
        output += data.toString();
      }
    };
    try {
      output = "";
      await actionsExec.exec("nix", ["store", "info", "--json"], options);
      this.addFact(FACT_NIX_STORE_CHECK_METHOD, "info");
    } catch {
      try {
        output = "";
        await actionsExec.exec("nix", ["store", "ping", "--json"], options);
        this.addFact(FACT_NIX_STORE_CHECK_METHOD, "ping");
      } catch {
        this.addFact(FACT_NIX_STORE_CHECK_METHOD, "none");
        return;
      }
    }
    try {
      const parsed = JSON.parse(output);
      if (parsed.trusted === 1) {
        this.nixStoreTrust = "trusted";
      } else if (parsed.trusted === 0) {
        this.nixStoreTrust = "untrusted";
      } else if (parsed.trusted !== void 0) {
        this.addFact(
          FACT_NIX_STORE_CHECK_ERROR,
          `Mysterious trusted value: ${JSON.stringify(parsed.trusted)}`
        );
      }
      this.addFact(FACT_NIX_STORE_VERSION, JSON.stringify(parsed.version));
    } catch (e) {
      this.addFact(FACT_NIX_STORE_CHECK_ERROR, stringifyError2(e));
    }
  }
  async submitEvents() {
    const diagnosticsUrl = await this.idsHost.getDiagnosticsUrl();
    if (diagnosticsUrl === void 0) {
      actionsCore7.debug(
        "Diagnostics are disabled. Not sending the following events:"
      );
      actionsCore7.debug(JSON.stringify(this.events, void 0, 2));
      return;
    }
    const batch = {
      type: "eventlog",
      sent_at: /* @__PURE__ */ new Date(),
      events: this.events
    };
    try {
      await this.client.post(diagnosticsUrl, {
        json: batch,
        timeout: {
          request: DIAGNOSTIC_ENDPOINT_TIMEOUT_MS
        }
      });
    } catch (e) {
      actionsCore7.debug(
        `Error submitting diagnostics event: ${stringifyError2(e)}`
      );
    }
    this.events = [];
  }
};
function stringifyError2(error3) {
  return error3 instanceof Error || typeof error3 == "string" ? error3.toString() : JSON.stringify(error3);
}
function makeOptionsConfident(actionOptions) {
  const idsProjectName = actionOptions.idsProjectName ?? actionOptions.name;
  const finalOpts = {
    name: actionOptions.name,
    idsProjectName,
    eventPrefix: actionOptions.eventPrefix || "action:",
    fetchStyle: actionOptions.fetchStyle,
    legacySourcePrefix: actionOptions.legacySourcePrefix,
    requireNix: actionOptions.requireNix
  };
  actionsCore7.debug("idslib options:");
  actionsCore7.debug(JSON.stringify(finalOpts, void 0, 2));
  return finalOpts;
}
export {
  DetSysAction,
  inputs_exports as inputs,
  platform_exports as platform,
  stringifyError
};
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
//# sourceMappingURL=index.js.map
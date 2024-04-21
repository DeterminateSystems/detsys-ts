var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined")
    return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/.pnpm/linux-release-info@3.0.0/node_modules/linux-release-info/dist/index.js
var require_dist = __commonJS({
  "node_modules/.pnpm/linux-release-info@3.0.0/node_modules/linux-release-info/dist/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var fs2 = __require("fs");
    var os2 = __require("os");
    var util_1 = __require("util");
    var readFileAsync = util_1.promisify(fs2.readFile);
    var linuxReleaseInfoOptionsDefaults = {
      mode: "async",
      custom_file: null,
      debug: false
    };
    function releaseInfo2(options) {
      options = { ...linuxReleaseInfoOptionsDefaults, ...options };
      const searchOsreleaseFileList = osreleaseFileList(options.custom_file);
      async function readAsyncOsreleaseFile(searchOsreleaseFileList2, options2) {
        let fileData = null;
        for (let os_release_file of searchOsreleaseFileList2) {
          try {
            if (options2.debug) {
              console.log(`Trying to read '${os_release_file}'...`);
            }
            fileData = await readFileAsync(os_release_file, "binary");
            if (options2.debug) {
              console.log("Read data:\n" + fileData);
            }
            break;
          } catch (error2) {
            if (options2.debug) {
              console.error(error2);
            }
          }
        }
        if (fileData === null) {
          throw new Error("Cannot read os-release file!");
        }
        return formatFileData(getOsInfo(), fileData);
      }
      function readSyncOsreleaseFile(searchOsreleaseFileList2, options2) {
        let fileData = null;
        for (let os_release_file of searchOsreleaseFileList2) {
          try {
            if (options2.debug) {
              console.log(`Trying to read '${os_release_file}'...`);
            }
            fileData = fs2.readFileSync(os_release_file, "binary");
            if (options2.debug) {
              console.log("Read data:\n" + fileData);
            }
            break;
          } catch (error2) {
            if (options2.debug) {
              console.error(error2);
            }
          }
        }
        if (fileData === null) {
          throw new Error("Cannot read os-release file!");
        }
        return formatFileData(getOsInfo(), fileData);
      }
      if (os2.type() !== "Linux") {
        if (options.mode === "sync") {
          return getOsInfo();
        } else {
          return Promise.resolve(getOsInfo());
        }
      }
      if (options.mode === "sync") {
        return readSyncOsreleaseFile(searchOsreleaseFileList, options);
      } else {
        return Promise.resolve(readAsyncOsreleaseFile(searchOsreleaseFileList, options));
      }
    }
    exports.releaseInfo = releaseInfo2;
    function formatFileData(sourceData, srcParseData) {
      const lines = srcParseData.split("\n");
      lines.forEach((element) => {
        const linedata = element.split("=");
        if (linedata.length === 2) {
          linedata[1] = linedata[1].replace(/["'\r]/gi, "");
          Object.defineProperty(sourceData, linedata[0].toLowerCase(), {
            value: linedata[1],
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      });
      return sourceData;
    }
    function osreleaseFileList(customFile) {
      const DEFAULT_OS_RELEASE_FILES = ["/etc/os-release", "/usr/lib/os-release"];
      if (!customFile) {
        return DEFAULT_OS_RELEASE_FILES;
      } else {
        return Array(customFile);
      }
    }
    function getOsInfo() {
      const osInfo = {
        type: os2.type(),
        platform: os2.platform(),
        hostname: os2.hostname(),
        arch: os2.arch(),
        release: os2.release()
      };
      return osInfo;
    }
  }
});

// package.json
var version = "1.0.0";

// src/actions-core-platform.ts
var import_linux_release_info = __toESM(require_dist(), 1);
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import os from "os";
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
    data = (0, import_linux_release_info.releaseInfo)({ mode: "sync" });
    console.log(data);
  } catch (e) {
    core.debug(`Error collecting release info: ${e}`);
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
var platform = os.platform();
var arch = os.arch();
var isWindows = platform === "win32";
var isMacOS = platform === "darwin";
var isLinux = platform === "linux";
async function getDetails() {
  return {
    ...await (isWindows ? getWindowsInfo() : isMacOS ? getMacOsInfo() : getLinuxInfo()),
    platform,
    arch,
    isWindows,
    isMacOS,
    isLinux
  };
}

// src/correlation.ts
import * as actionsCore from "@actions/core";
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
  actionsCore.debug("Correlation data:");
  actionsCore.debug(JSON.stringify(ident, null, 2));
  return ident;
}
function hashEnvironmentVariables(prefix, variables) {
  const hash = createHash("sha256");
  for (const varName of variables) {
    let value = process.env[varName];
    if (value === void 0) {
      if (OPTIONAL_VARIABLES.includes(varName)) {
        actionsCore.debug(
          `Optional environment variable not set: ${varName} -- substituting with the variable name`
        );
        value = varName;
      } else {
        actionsCore.debug(
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

// src/platform.ts
var platform_exports = {};
__export(platform_exports, {
  getArchOs: () => getArchOs,
  getNixPlatform: () => getNixPlatform
});
import * as actionsCore2 from "@actions/core";
function getArchOs() {
  const envArch = process.env.RUNNER_ARCH;
  const envOs = process.env.RUNNER_OS;
  if (envArch && envOs) {
    return `${envArch}-${envOs}`;
  } else {
    actionsCore2.error(
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
    actionsCore2.error(
      `ArchOs (${archOs}) doesn't map to a supported Nix platform.`
    );
    throw new Error(
      `Cannot convert ArchOs (${archOs}) to a supported Nix platform.`
    );
  }
}

// src/inputs.ts
var inputs_exports = {};
__export(inputs_exports, {
  getBool: () => getBool,
  getMultilineStringOrNull: () => getMultilineStringOrNull,
  getNumberOrNull: () => getNumberOrNull,
  getString: () => getString,
  getStringOrNull: () => getStringOrNull,
  getStringOrUndefined: () => getStringOrUndefined
});
import * as actionsCore3 from "@actions/core";
var getBool = (name) => {
  return actionsCore3.getBooleanInput(name);
};
var getMultilineStringOrNull = (name) => {
  const value = actionsCore3.getMultilineInput(name);
  if (value.length === 0) {
    return null;
  } else {
    return value;
  }
};
var getNumberOrNull = (name) => {
  const value = actionsCore3.getInput(name);
  if (value === "") {
    return null;
  } else {
    return Number(value);
  }
};
var getString = (name) => {
  return actionsCore3.getInput(name);
};
var getStringOrNull = (name) => {
  const value = actionsCore3.getInput(name);
  if (value === "") {
    return null;
  } else {
    return value;
  }
};
var getStringOrUndefined = (name) => {
  const value = actionsCore3.getInput(name);
  if (value === "") {
    return void 0;
  } else {
    return value;
  }
};

// src/sourcedef.ts
import * as actionsCore4 from "@actions/core";
function constructSourceParameters(legacyPrefix) {
  const noisilyGetInput = (suffix) => {
    const preferredInput = getStringOrUndefined(`source-${suffix}`);
    if (!legacyPrefix) {
      return preferredInput;
    }
    const legacyInput = getStringOrUndefined(`${legacyPrefix}-${suffix}`);
    if (preferredInput && legacyInput) {
      actionsCore4.warning(
        `The supported option source-${suffix} and the legacy option ${legacyPrefix}-${suffix} are both set. Preferring source-${suffix}. Please stop setting ${legacyPrefix}-${suffix}.`
      );
      return preferredInput;
    } else if (legacyInput) {
      actionsCore4.warning(
        `The legacy option ${legacyPrefix}-${suffix} is set. Please migrate to source-${suffix}.`
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
    revision: noisilyGetInput("revision")
  };
}

// src/index.ts
import * as actionsCache from "@actions/cache";
import * as actionsCore5 from "@actions/core";
import got from "got";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import fs, { chmod, copyFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { pipeline } from "node:stream/promises";
var DEFAULT_IDS_HOST = "https://install.determinate.systems";
var IDS_HOST = process.env["IDS_HOST"] ?? DEFAULT_IDS_HOST;
var EVENT_EXCEPTION = "exception";
var EVENT_ARTIFACT_CACHE_HIT = "artifact_cache_hit";
var EVENT_ARTIFACT_CACHE_MISS = "artifact_cache_miss";
var FACT_ENDED_WITH_EXCEPTION = "ended_with_exception";
var FACT_FINAL_EXCEPTION = "final_exception";
var IdsToolbox = class {
  constructor(actionOptions) {
    this.actionOptions = makeOptionsConfident(actionOptions);
    this.hookMain = void 0;
    this.hookPost = void 0;
    this.events = [];
    this.client = got.extend({
      retry: {
        limit: 3,
        methods: ["GET", "HEAD"]
      },
      hooks: {
        beforeRetry: [
          (error2, retryCount) => {
            actionsCore5.info(
              `Retrying after error ${error2.code}, retry #: ${retryCount}`
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
          this.addFact("$os", details.name);
        }
        if (details.version !== "unknown") {
          this.addFact("$os_version", details.version);
        }
      }).catch((e) => {
        actionsCore5.debug(`Failure getting platform details: ${e}`);
      });
    }
    {
      const phase = actionsCore5.getState("idstoolbox_execution_phase");
      if (phase === "") {
        actionsCore5.saveState("idstoolbox_execution_phase", "post");
        this.executionPhase = "main";
      } else {
        this.executionPhase = "post";
      }
      this.facts.execution_phase = this.executionPhase;
    }
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
  onMain(callback) {
    this.hookMain = callback;
  }
  onPost(callback) {
    this.hookPost = callback;
  }
  execute() {
    this.executeAsync().catch((error2) => {
      console.log(error2);
      process.exitCode = 1;
    });
  }
  async executeAsync() {
    try {
      process.env.DETSYS_CORRELATION = JSON.stringify(
        this.getCorrelationHashes()
      );
      if (!await this.preflightRequireNix()) {
        this.recordEvent("preflight-require-nix-denied");
        return;
      }
      if (this.executionPhase === "main" && this.hookMain) {
        await this.hookMain();
      } else if (this.executionPhase === "post" && this.hookPost) {
        await this.hookPost();
      }
      this.addFact(FACT_ENDED_WITH_EXCEPTION, false);
    } catch (error2) {
      this.addFact(FACT_ENDED_WITH_EXCEPTION, true);
      const reportable = error2 instanceof Error || typeof error2 == "string" ? error2.toString() : JSON.stringify(error2);
      this.addFact(FACT_FINAL_EXCEPTION, reportable);
      if (this.executionPhase === "post") {
        actionsCore5.warning(reportable);
      } else {
        actionsCore5.setFailed(reportable);
      }
      this.recordEvent(EVENT_EXCEPTION);
    } finally {
      await this.complete();
    }
  }
  addFact(key, value) {
    this.facts[key] = value;
  }
  getDiagnosticsUrl() {
    return this.actionOptions.diagnosticsUrl;
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
  async fetch() {
    actionsCore5.info(`Fetching from ${this.getUrl()}`);
    const correlatedUrl = this.getUrl();
    correlatedUrl.searchParams.set("ci", "github");
    correlatedUrl.searchParams.set(
      "correlation",
      JSON.stringify(this.identity)
    );
    const versionCheckup = await this.client.head(correlatedUrl);
    if (versionCheckup.headers.etag) {
      const v = versionCheckup.headers.etag;
      actionsCore5.debug(`Checking the tool cache for ${this.getUrl()} at ${v}`);
      const cached = await this.getCachedVersion(v);
      if (cached) {
        this.facts["artifact_fetched_from_cache"] = true;
        actionsCore5.debug(`Tool cache hit.`);
        return cached;
      }
    }
    this.facts["artifact_fetched_from_cache"] = false;
    actionsCore5.debug(
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
        actionsCore5.debug(`Error caching the artifact: ${e}`);
      }
    }
    return destFile;
  }
  async fetchExecutable() {
    const binaryPath = await this.fetch();
    await chmod(binaryPath, fs.constants.S_IXUSR | fs.constants.S_IXGRP);
    return binaryPath;
  }
  async complete() {
    this.recordEvent(`complete_${this.executionPhase}`);
    await this.submitEvents();
  }
  getUrl() {
    const p = this.sourceParameters;
    if (p.url) {
      return new URL(p.url);
    }
    const fetchUrl = new URL(IDS_HOST);
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
      this.recordEvent(EVENT_ARTIFACT_CACHE_HIT);
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
        await fs.access(candidateNix, fs.constants.X_OK);
        actionsCore5.debug(`Found Nix at ${candidateNix}`);
        nixLocation = candidateNix;
      } catch {
        actionsCore5.debug(`Nix not at ${candidateNix}`);
      }
    }
    this.addFact("nix_location", nixLocation || "");
    if (this.actionOptions.requireNix === "ignore") {
      return true;
    }
    const currentNotFoundState = actionsCore5.getState(
      "idstoolbox_nix_not_found"
    );
    if (currentNotFoundState === "not-found") {
      return false;
    }
    if (nixLocation !== void 0) {
      return true;
    }
    actionsCore5.saveState("idstoolbox_nix_not_found", "not-found");
    switch (this.actionOptions.requireNix) {
      case "fail":
        actionsCore5.setFailed(
          "This action can only be used when Nix is installed. Add `- uses: DeterminateSystems/nix-installer-action@main` earlier in your workflow."
        );
        break;
      case "warn":
        actionsCore5.warning(
          "This action is in no-op mode because Nix is not installed. Add `- uses: DeterminateSystems/nix-installer-action@main` earlier in your workflow."
        );
        break;
    }
    return false;
  }
  async submitEvents() {
    if (!this.actionOptions.diagnosticsUrl) {
      actionsCore5.debug(
        "Diagnostics are disabled. Not sending the following events:"
      );
      actionsCore5.debug(JSON.stringify(this.events, void 0, 2));
      return;
    }
    const batch = {
      type: "eventlog",
      sent_at: /* @__PURE__ */ new Date(),
      events: this.events
    };
    try {
      await this.client.post(this.actionOptions.diagnosticsUrl, {
        json: batch
      });
    } catch (error2) {
      actionsCore5.debug(`Error submitting diagnostics event: ${error2}`);
    }
    this.events = [];
  }
  getTemporaryName() {
    const _tmpdir = process.env["RUNNER_TEMP"] || tmpdir();
    return path.join(_tmpdir, `${this.actionOptions.name}-${randomUUID()}`);
  }
};
function makeOptionsConfident(actionOptions) {
  const idsProjectName = actionOptions.idsProjectName ?? actionOptions.name;
  const finalOpts = {
    name: actionOptions.name,
    idsProjectName,
    eventPrefix: actionOptions.eventPrefix || "action:",
    fetchStyle: actionOptions.fetchStyle,
    legacySourcePrefix: actionOptions.legacySourcePrefix,
    requireNix: actionOptions.requireNix,
    diagnosticsUrl: determineDiagnosticsUrl(
      idsProjectName,
      actionOptions.diagnosticsUrl
    )
  };
  actionsCore5.debug("idslib options:");
  actionsCore5.debug(JSON.stringify(finalOpts, void 0, 2));
  return finalOpts;
}
function determineDiagnosticsUrl(idsProjectName, urlOption) {
  if (urlOption === null) {
    return void 0;
  }
  if (urlOption !== void 0) {
    return urlOption;
  }
  {
    const providedDiagnosticEndpoint = process.env["INPUT_DIAGNOSTIC-ENDPOINT"];
    if (providedDiagnosticEndpoint === "") {
      return void 0;
    }
    if (providedDiagnosticEndpoint !== void 0) {
      try {
        return mungeDiagnosticEndpoint(new URL(providedDiagnosticEndpoint));
      } catch (e) {
        actionsCore5.info(
          `User-provided diagnostic endpoint ignored: not a valid URL: ${e}`
        );
      }
    }
  }
  try {
    const diagnosticUrl = new URL(IDS_HOST);
    diagnosticUrl.pathname += idsProjectName;
    diagnosticUrl.pathname += "/diagnostics";
    return diagnosticUrl;
  } catch (e) {
    actionsCore5.info(
      `Generated diagnostic endpoint ignored: not a valid URL: ${e}`
    );
  }
  return void 0;
}
function mungeDiagnosticEndpoint(inputUrl) {
  if (DEFAULT_IDS_HOST === IDS_HOST) {
    return inputUrl;
  }
  try {
    const defaultIdsHost = new URL(DEFAULT_IDS_HOST);
    const currentIdsHost = new URL(IDS_HOST);
    if (inputUrl.origin !== defaultIdsHost.origin) {
      return inputUrl;
    }
    inputUrl.protocol = currentIdsHost.protocol;
    inputUrl.host = currentIdsHost.host;
    inputUrl.username = currentIdsHost.username;
    inputUrl.password = currentIdsHost.password;
    return inputUrl;
  } catch (e) {
    actionsCore5.info(`Default or overridden IDS host isn't a valid URL: ${e}`);
  }
  return inputUrl;
}
export {
  IdsToolbox,
  inputs_exports as inputs,
  platform_exports as platform
};
/*! Bundled license information:

linux-release-info/dist/index.js:
  (*!
   * linux-release-info
   * Get Linux release info (distribution name, version, arch, release, etc.)
   * from '/etc/os-release' or '/usr/lib/os-release' files and from native os
   * module. On Windows and Darwin platforms it only returns common node os module
   * info (platform, hostname, release, and arch)
   *
   * Licensed under MIT
   * Copyright (c) 2018-2020 [Samuel Carreira]
   *)
*/
//# sourceMappingURL=index.js.map
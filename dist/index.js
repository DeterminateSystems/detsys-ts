import { __export } from "./chunk-CTAAG5j7.js";
import * as fs$1 from "node:fs";
import { constants, createWriteStream, readFileSync } from "node:fs";
import * as os$1 from "node:os";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import * as actionsCore from "@actions/core";
import * as exec$1 from "@actions/exec";
import os from "os";
import fs, { chmod, copyFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import { gzip } from "node:zlib";
import { createHash, randomUUID } from "node:crypto";
import { TimeoutError, got } from "got";
import { resolveSrv } from "node:dns/promises";
import * as actionsCache from "@actions/cache";
import { exec } from "node:child_process";
import * as path from "node:path";

//#region src/linux-release-info.ts
const readFileAsync = promisify(fs$1.readFile);
const linuxReleaseInfoOptionsDefaults = {
	mode: "async",
	customFile: null,
	debug: false
};
/**
* Get OS release info from 'os-release' file and from native os module
* on Windows or Darwin it only returns common os module info
* (uses native fs module)
* @returns {object} info from the current os
*/
function releaseInfo(infoOptions) {
	const options = {
		...linuxReleaseInfoOptionsDefaults,
		...infoOptions
	};
	const searchOsReleaseFileList = osReleaseFileList(options.customFile);
	if (os$1.type() !== "Linux") if (options.mode === "sync") return getOsInfo();
	else return Promise.resolve(getOsInfo());
	if (options.mode === "sync") return readSyncOsreleaseFile(searchOsReleaseFileList, options);
	else return Promise.resolve(readAsyncOsReleaseFile(searchOsReleaseFileList, options));
}
/**
* Format file data: convert data to object keys/values
*
* @param {object} sourceData Source object to be appended
* @param {string} srcParseData Input file data to be parsed
* @returns {object} Formated object
*/
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
/**
* Export a list of os-release files
*
* @param {string} customFile optional custom complete filepath
* @returns {array} list of os-release files
*/
function osReleaseFileList(customFile) {
	const DEFAULT_OS_RELEASE_FILES = ["/etc/os-release", "/usr/lib/os-release"];
	if (!customFile) return DEFAULT_OS_RELEASE_FILES;
	else return Array(customFile);
}
/**
* Get OS Basic Info
* (uses node 'os' native module)
*
* @returns {OsInfo} os basic info
*/
function getOsInfo() {
	return {
		type: os$1.type(),
		platform: os$1.platform(),
		hostname: os$1.hostname(),
		arch: os$1.arch(),
		release: os$1.release()
	};
}
async function readAsyncOsReleaseFile(fileList, options) {
	let fileData = null;
	for (const osReleaseFile of fileList) try {
		if (options.debug) console.log(`Trying to read '${osReleaseFile}'...`);
		fileData = await readFileAsync(osReleaseFile, "binary");
		if (options.debug) console.log(`Read data:\n${fileData}`);
		break;
	} catch (error) {
		if (options.debug) console.error(error);
	}
	if (fileData === null) throw new Error("Cannot read os-release file!");
	return formatFileData(getOsInfo(), fileData);
}
function readSyncOsreleaseFile(releaseFileList, options) {
	let fileData = null;
	for (const osReleaseFile of releaseFileList) try {
		if (options.debug) console.log(`Trying to read '${osReleaseFile}'...`);
		fileData = fs$1.readFileSync(osReleaseFile, "binary");
		if (options.debug) console.log(`Read data:\n${fileData}`);
		break;
	} catch (error) {
		if (options.debug) console.error(error);
	}
	if (fileData === null) throw new Error("Cannot read os-release file!");
	return formatFileData(getOsInfo(), fileData);
}

//#endregion
//#region src/actions-core-platform.ts
/**
* Get the name and version of the current Windows system.
*/
const getWindowsInfo = async () => {
	const { stdout: version } = await exec$1.getExecOutput("powershell -command \"(Get-CimInstance -ClassName Win32_OperatingSystem).Version\"", void 0, { silent: true });
	const { stdout: name } = await exec$1.getExecOutput("powershell -command \"(Get-CimInstance -ClassName Win32_OperatingSystem).Caption\"", void 0, { silent: true });
	return {
		name: name.trim(),
		version: version.trim()
	};
};
/**
* Get the name and version of the current macOS system.
*/
const getMacOsInfo = async () => {
	const { stdout } = await exec$1.getExecOutput("sw_vers", void 0, { silent: true });
	const version = stdout.match(/ProductVersion:\s*(.+)/)?.[1] ?? "";
	return {
		name: stdout.match(/ProductName:\s*(.+)/)?.[1] ?? "",
		version
	};
};
/**
* Get the name and version of the current Linux system.
*/
const getLinuxInfo = async () => {
	let data = {};
	try {
		data = releaseInfo({ mode: "sync" });
		actionsCore.debug(`Identified release info: ${JSON.stringify(data)}`);
	} catch (e) {
		actionsCore.debug(`Error collecting release info: ${e}`);
	}
	return {
		name: getPropertyViaWithDefault(data, [
			"id",
			"name",
			"pretty_name",
			"id_like"
		], "unknown"),
		version: getPropertyViaWithDefault(data, [
			"version_id",
			"version",
			"version_codename"
		], "unknown")
	};
};
function getPropertyViaWithDefault(data, names, defaultValue) {
	for (const name of names) {
		const ret = getPropertyWithDefault(data, name, defaultValue);
		if (ret !== defaultValue) return ret;
	}
	return defaultValue;
}
function getPropertyWithDefault(data, name, defaultValue) {
	if (!data.hasOwnProperty(name)) return defaultValue;
	const value = data[name];
	if (typeof value !== typeof defaultValue) return defaultValue;
	return value;
}
/**
* The Action runner's platform.
*/
const platform = os.platform();
/**
* The Action runner's architecture.
*/
const arch = os.arch();
/**
* Whether the Action runner is a Windows system.
*/
const isWindows = platform === "win32";
/**
* Whether the Action runner is a macOS system.
*/
const isMacOS = platform === "darwin";
/**
* Whether the Action runner is a Linux system.
*/
const isLinux = platform === "linux";
/**
* Get system-level information about the current host (platform, architecture, etc.).
*/
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

//#endregion
//#region src/errors.ts
/**
* Coerce a value of type `unknown` into a string.
*/
function stringifyError(e) {
	if (e instanceof Error) return e.message;
	else if (typeof e === "string") return e;
	else return JSON.stringify(e);
}

//#endregion
//#region src/backtrace.ts
const START_SLOP_SECONDS = 5;
async function collectBacktraces(prefixes, programNameDenyList, startTimestampMs) {
	if (isMacOS) return await collectBacktracesMacOS(prefixes, programNameDenyList, startTimestampMs);
	if (isLinux) return await collectBacktracesSystemd(prefixes, programNameDenyList, startTimestampMs);
	return /* @__PURE__ */ new Map();
}
async function collectBacktracesMacOS(prefixes, programNameDenyList, startTimestampMs) {
	const backtraces = /* @__PURE__ */ new Map();
	try {
		const { stdout: logJson } = await exec$1.getExecOutput("log", [
			"show",
			"--style",
			"json",
			"--last",
			"1m",
			"--no-info",
			"--predicate",
			"sender = 'ReportCrash'"
		], { silent: true });
		const sussyArray = JSON.parse(logJson);
		if (!Array.isArray(sussyArray)) throw new Error(`Log json isn't an array: ${logJson}`);
		if (sussyArray.length > 0) {
			actionsCore.info(`Collecting crash data...`);
			const delay = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));
			await delay(5e3);
		}
	} catch {
		actionsCore.debug("Failed to check logs for in-progress crash dumps; now proceeding with the assumption that all crash dumps completed.");
	}
	const dirs = [["system", "/Library/Logs/DiagnosticReports/"], ["user", `${process.env["HOME"]}/Library/Logs/DiagnosticReports/`]];
	for (const [source, dir] of dirs) {
		const fileNames = (await readdir(dir)).filter((fileName) => {
			return prefixes.some((prefix) => fileName.startsWith(prefix));
		}).filter((fileName) => {
			return !programNameDenyList.some((programName) => fileName.startsWith(programName));
		}).filter((fileName) => {
			return !fileName.endsWith(".diag");
		});
		const doGzip = promisify(gzip);
		for (const fileName of fileNames) try {
			if ((await stat(`${dir}/${fileName}`)).ctimeMs >= startTimestampMs) {
				const logText = await readFile(`${dir}/${fileName}`);
				const buf = await doGzip(logText);
				backtraces.set(`backtrace_value_${source}_${fileName}`, buf.toString("base64"));
			}
		} catch (innerError) {
			backtraces.set(`backtrace_failure_${source}_${fileName}`, stringifyError(innerError));
		}
	}
	return backtraces;
}
async function collectBacktracesSystemd(prefixes, programNameDenyList, startTimestampMs) {
	const sinceSeconds = Math.ceil((Date.now() - startTimestampMs) / 1e3) + START_SLOP_SECONDS;
	const backtraces = /* @__PURE__ */ new Map();
	const coredumps = [];
	try {
		const { stdout: coredumpjson } = await exec$1.getExecOutput("coredumpctl", [
			"--json=pretty",
			"list",
			"--since",
			`${sinceSeconds} seconds ago`
		], { silent: true });
		const sussyArray = JSON.parse(coredumpjson);
		if (!Array.isArray(sussyArray)) throw new Error(`Coredump isn't an array: ${coredumpjson}`);
		for (const sussyObject of sussyArray) {
			const keys = Object.keys(sussyObject);
			if (keys.includes("exe") && keys.includes("pid")) if (typeof sussyObject.exe == "string" && typeof sussyObject.pid == "number") {
				const execParts = sussyObject.exe.split("/");
				const binaryName = execParts[execParts.length - 1];
				if (prefixes.some((prefix) => binaryName.startsWith(prefix)) && !programNameDenyList.includes(binaryName)) coredumps.push({
					exe: sussyObject.exe,
					pid: sussyObject.pid
				});
			} else actionsCore.debug(`Mysterious coredump entry missing exe string and/or pid number: ${JSON.stringify(sussyObject)}`);
			else actionsCore.debug(`Mysterious coredump entry missing exe value and/or pid value: ${JSON.stringify(sussyObject)}`);
		}
	} catch (innerError) {
		actionsCore.debug(`Cannot collect backtraces: ${stringifyError(innerError)}`);
		return backtraces;
	}
	const doGzip = promisify(gzip);
	for (const coredump of coredumps) try {
		const { stdout: logText } = await exec$1.getExecOutput("coredumpctl", ["info", `${coredump.pid}`], { silent: true });
		const buf = await doGzip(logText);
		backtraces.set(`backtrace_value_${coredump.pid}`, buf.toString("base64"));
	} catch (innerError) {
		backtraces.set(`backtrace_failure_${coredump.pid}`, stringifyError(innerError));
	}
	return backtraces;
}

//#endregion
//#region src/correlation.ts
const OPTIONAL_VARIABLES = ["INVOCATION_ID"];
function identify() {
	const repository = hashEnvironmentVariables("GHR", [
		"GITHUB_SERVER_URL",
		"GITHUB_REPOSITORY_OWNER",
		"GITHUB_REPOSITORY_OWNER_ID",
		"GITHUB_REPOSITORY",
		"GITHUB_REPOSITORY_ID"
	]);
	const run_differentiator = hashEnvironmentVariables("GHWJA", [
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
	]);
	const ident = {
		$anon_distinct_id: process.env["RUNNER_TRACKING_ID"] || randomUUID(),
		correlation_source: "github-actions",
		github_repository_hash: repository,
		github_workflow_hash: hashEnvironmentVariables("GHW", [
			"GITHUB_SERVER_URL",
			"GITHUB_REPOSITORY_OWNER",
			"GITHUB_REPOSITORY_OWNER_ID",
			"GITHUB_REPOSITORY",
			"GITHUB_REPOSITORY_ID",
			"GITHUB_WORKFLOW"
		]),
		github_workflow_job_hash: hashEnvironmentVariables("GHWJ", [
			"GITHUB_SERVER_URL",
			"GITHUB_REPOSITORY_OWNER",
			"GITHUB_REPOSITORY_OWNER_ID",
			"GITHUB_REPOSITORY",
			"GITHUB_REPOSITORY_ID",
			"GITHUB_WORKFLOW",
			"GITHUB_JOB"
		]),
		github_workflow_run_hash: hashEnvironmentVariables("GHWJR", [
			"GITHUB_SERVER_URL",
			"GITHUB_REPOSITORY_OWNER",
			"GITHUB_REPOSITORY_OWNER_ID",
			"GITHUB_REPOSITORY",
			"GITHUB_REPOSITORY_ID",
			"GITHUB_WORKFLOW",
			"GITHUB_JOB",
			"GITHUB_RUN_ID"
		]),
		github_workflow_run_differentiator_hash: run_differentiator,
		$session_id: run_differentiator,
		$groups: {
			github_repository: repository,
			github_organization: hashEnvironmentVariables("GHO", [
				"GITHUB_SERVER_URL",
				"GITHUB_REPOSITORY_OWNER",
				"GITHUB_REPOSITORY_OWNER_ID"
			])
		},
		is_ci: true
	};
	actionsCore.debug("Correlation data:");
	actionsCore.debug(JSON.stringify(ident, null, 2));
	return ident;
}
function hashEnvironmentVariables(prefix, variables) {
	const hash = createHash("sha256");
	for (const varName of variables) {
		let value = process.env[varName];
		if (value === void 0) if (OPTIONAL_VARIABLES.includes(varName)) {
			actionsCore.debug(`Optional environment variable not set: ${varName} -- substituting with the variable name`);
			value = varName;
		} else {
			actionsCore.debug(`Environment variable not set: ${varName} -- can't generate the requested identity`);
			return;
		}
		hash.update(value);
		hash.update("\0");
	}
	return `${prefix}-${hash.digest("hex")}`;
}

//#endregion
//#region src/ids-host.ts
const DEFAULT_LOOKUP = "_detsys_ids._tcp.install.determinate.systems.";
const ALLOWED_SUFFIXES = [".install.determinate.systems", ".install.detsys.dev"];
const DEFAULT_IDS_HOST = "https://install.determinate.systems";
const LOOKUP = process.env["IDS_LOOKUP"] ?? DEFAULT_LOOKUP;
const DEFAULT_TIMEOUT = 1e4;
/**
* Host information for install.determinate.systems.
*/
var IdsHost = class {
	constructor(idsProjectName, diagnosticsSuffix, runtimeDiagnosticsUrl) {
		this.idsProjectName = idsProjectName;
		this.diagnosticsSuffix = diagnosticsSuffix;
		this.runtimeDiagnosticsUrl = runtimeDiagnosticsUrl;
		this.client = void 0;
	}
	async getGot(recordFailoverCallback) {
		if (this.client === void 0) this.client = got.extend({
			timeout: { request: DEFAULT_TIMEOUT },
			retry: {
				limit: Math.max((await this.getUrlsByPreference()).length, 3),
				methods: ["GET", "HEAD"]
			},
			hooks: {
				beforeRetry: [async (error, retryCount) => {
					const prevUrl = await this.getRootUrl();
					this.markCurrentHostBroken();
					const nextUrl = await this.getRootUrl();
					if (recordFailoverCallback !== void 0) recordFailoverCallback(error, prevUrl, nextUrl);
					actionsCore.info(`Retrying after error ${error.code}, retry #: ${retryCount}`);
				}],
				beforeRequest: [async (options) => {
					const currentUrl = options.url;
					if (this.isUrlSubjectToDynamicUrls(currentUrl)) {
						const newUrl = new URL(currentUrl);
						newUrl.host = (await this.getRootUrl()).host;
						options.url = newUrl;
						actionsCore.debug(`Transmuted ${currentUrl} into ${newUrl}`);
					} else actionsCore.debug(`No transmutations on ${currentUrl}`);
				}]
			}
		});
		return this.client;
	}
	markCurrentHostBroken() {
		this.prioritizedURLs?.shift();
	}
	setPrioritizedUrls(urls) {
		this.prioritizedURLs = urls;
	}
	isUrlSubjectToDynamicUrls(url) {
		if (url.origin === DEFAULT_IDS_HOST) return true;
		for (const suffix of ALLOWED_SUFFIXES) if (url.host.endsWith(suffix)) return true;
		return false;
	}
	async getDynamicRootUrl() {
		const idsHost = process.env["IDS_HOST"];
		if (idsHost !== void 0) try {
			return new URL(idsHost);
		} catch (err) {
			actionsCore.error(`IDS_HOST environment variable is not a valid URL. Ignoring. ${stringifyError(err)}`);
		}
		let url = void 0;
		try {
			url = (await this.getUrlsByPreference())[0];
		} catch (err) {
			actionsCore.error(`Error collecting IDS URLs by preference: ${stringifyError(err)}`);
		}
		if (url === void 0) return;
		else return new URL(url);
	}
	async getRootUrl() {
		const url = await this.getDynamicRootUrl();
		if (url === void 0) return new URL(DEFAULT_IDS_HOST);
		return url;
	}
	async getDiagnosticsUrl() {
		if (this.runtimeDiagnosticsUrl === "") return;
		if (this.runtimeDiagnosticsUrl !== "-" && this.runtimeDiagnosticsUrl !== void 0) try {
			return new URL(this.runtimeDiagnosticsUrl);
		} catch (err) {
			actionsCore.info(`User-provided diagnostic endpoint ignored: not a valid URL: ${stringifyError(err)}`);
		}
		try {
			const diagnosticUrl = await this.getRootUrl();
			diagnosticUrl.pathname += "events/batch";
			return diagnosticUrl;
		} catch (err) {
			actionsCore.info(`Generated diagnostic endpoint ignored, and diagnostics are disabled: not a valid URL: ${stringifyError(err)}`);
			return;
		}
	}
	async getUrlsByPreference() {
		if (this.prioritizedURLs === void 0) this.prioritizedURLs = orderRecordsByPriorityWeight(await discoverServiceRecords()).flatMap((record) => recordToUrl(record) || []);
		return this.prioritizedURLs;
	}
};
function recordToUrl(record) {
	const urlStr = `https://${record.name}:${record.port}`;
	try {
		return new URL(urlStr);
	} catch (err) {
		actionsCore.debug(`Record ${JSON.stringify(record)} produced an invalid URL: ${urlStr} (${err})`);
		return;
	}
}
async function discoverServiceRecords() {
	return await discoverServicesStub(resolveSrv(LOOKUP), 1e3);
}
async function discoverServicesStub(lookup, timeout) {
	const defaultFallback = new Promise((resolve, _reject) => {
		setTimeout(resolve, timeout, []);
	});
	let records;
	try {
		records = await Promise.race([lookup, defaultFallback]);
	} catch (reason) {
		actionsCore.debug(`Error resolving SRV records: ${stringifyError(reason)}`);
		records = [];
	}
	const acceptableRecords = records.filter((record) => {
		for (const suffix of ALLOWED_SUFFIXES) if (record.name.endsWith(suffix)) return true;
		actionsCore.debug(`Unacceptable domain due to an invalid suffix: ${record.name}`);
		return false;
	});
	if (acceptableRecords.length === 0) actionsCore.debug(`No records found for ${LOOKUP}`);
	else actionsCore.debug(`Resolved ${LOOKUP} to ${JSON.stringify(acceptableRecords)}`);
	return acceptableRecords;
}
function orderRecordsByPriorityWeight(records) {
	const byPriorityWeight = /* @__PURE__ */ new Map();
	for (const record of records) {
		const existing = byPriorityWeight.get(record.priority);
		if (existing) existing.push(record);
		else byPriorityWeight.set(record.priority, [record]);
	}
	const prioritizedRecords = [];
	const keys = Array.from(byPriorityWeight.keys()).sort((a, b) => a - b);
	for (const priority of keys) {
		const recordsByPrio = byPriorityWeight.get(priority);
		if (recordsByPrio === void 0) continue;
		prioritizedRecords.push(...weightedRandom(recordsByPrio));
	}
	return prioritizedRecords;
}
function weightedRandom(records) {
	const scratchRecords = records.slice();
	const result = [];
	while (scratchRecords.length > 0) {
		const weights = [];
		for (let i = 0; i < scratchRecords.length; i++) weights.push(scratchRecords[i].weight + (i > 0 ? scratchRecords[i - 1].weight : 0));
		const point = Math.random() * weights[weights.length - 1];
		for (let selectedIndex = 0; selectedIndex < weights.length; selectedIndex++) if (weights[selectedIndex] > point) {
			result.push(scratchRecords.splice(selectedIndex, 1)[0]);
			break;
		}
	}
	return result;
}

//#endregion
//#region src/inputs.ts
var inputs_exports = __export({
	getArrayOfStrings: () => getArrayOfStrings,
	getArrayOfStringsOrNull: () => getArrayOfStringsOrNull,
	getBool: () => getBool,
	getBoolOrUndefined: () => getBoolOrUndefined,
	getMultilineStringOrNull: () => getMultilineStringOrNull,
	getNumberOrNull: () => getNumberOrNull,
	getString: () => getString,
	getStringOrNull: () => getStringOrNull,
	getStringOrUndefined: () => getStringOrUndefined,
	handleString: () => handleString
});
/**
* Get a Boolean input from the Action's configuration by name.
*/
const getBool = (name) => {
	return actionsCore.getBooleanInput(name);
};
/**
* Get a Boolean input from the Action's configuration by name, or undefined if it is unset.
*/
const getBoolOrUndefined = (name) => {
	if (getStringOrUndefined(name) === void 0) return;
	return actionsCore.getBooleanInput(name);
};
/**
* Convert a comma-separated string input into an array of strings. If `comma` is selected,
* all whitespace is removed from the string before converting to an array.
*/
const getArrayOfStrings = (name, separator) => {
	const original = getString(name);
	return handleString(original, separator);
};
/**
* Convert a string input into an array of strings or `null` if no value is set.
*/
const getArrayOfStringsOrNull = (name, separator) => {
	const original = getStringOrNull(name);
	if (original === null) return null;
	else return handleString(original, separator);
};
const handleString = (input, separator) => {
	const sepChar = separator === "comma" ? "," : /\s+/;
	const trimmed = input.trim();
	if (trimmed === "") return [];
	return trimmed.split(sepChar).map((s) => s.trim());
};
/**
* Get a multi-line string input from the Action's configuration by name or return `null` if not set.
*/
const getMultilineStringOrNull = (name) => {
	const value = actionsCore.getMultilineInput(name);
	if (value.length === 0) return null;
	else return value;
};
/**
* Get a number input from the Action's configuration by name or return `null` if not set.
*/
const getNumberOrNull = (name) => {
	const value = actionsCore.getInput(name);
	if (value === "") return null;
	else return Number(value);
};
/**
* Get a string input from the Action's configuration.
*/
const getString = (name) => {
	return actionsCore.getInput(name);
};
/**
* Get a string input from the Action's configuration by name or return `null` if not set.
*/
const getStringOrNull = (name) => {
	const value = actionsCore.getInput(name);
	if (value === "") return null;
	else return value;
};
/**
* Get a string input from the Action's configuration by name or return `undefined` if not set.
*/
const getStringOrUndefined = (name) => {
	const value = actionsCore.getInput(name);
	if (value === "") return;
	else return value;
};

//#endregion
//#region src/platform.ts
var platform_exports = __export({
	getArchOs: () => getArchOs,
	getNixPlatform: () => getNixPlatform
});
/**
* Get the current architecture plus OS. Examples include `X64-Linux` and `ARM64-macOS`.
*/
function getArchOs() {
	const envArch = process.env.RUNNER_ARCH;
	const envOs = process.env.RUNNER_OS;
	if (envArch && envOs) return `${envArch}-${envOs}`;
	else {
		actionsCore.error(`Can't identify the platform: RUNNER_ARCH or RUNNER_OS undefined (${envArch}-${envOs})`);
		throw new Error("RUNNER_ARCH and/or RUNNER_OS is not defined");
	}
}
/**
* Get the current Nix system. Examples include `x86_64-linux` and `aarch64-darwin`.
*/
function getNixPlatform(archOs) {
	const mappedTo = new Map([
		["X64-macOS", "x86_64-darwin"],
		["ARM64-macOS", "aarch64-darwin"],
		["X64-Linux", "x86_64-linux"],
		["ARM64-Linux", "aarch64-linux"]
	]).get(archOs);
	if (mappedTo) return mappedTo;
	else {
		actionsCore.error(`ArchOs (${archOs}) doesn't map to a supported Nix platform.`);
		throw new Error(`Cannot convert ArchOs (${archOs}) to a supported Nix platform.`);
	}
}

//#endregion
//#region src/sourcedef.ts
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
	if (!legacyPrefix) return preferredInput;
	const legacyInput = getStringOrUndefined(`${legacyPrefix}-${suffix}`);
	if (preferredInput && legacyInput) {
		actionsCore.warning(`The supported option source-${suffix} and the legacy option ${legacyPrefix}-${suffix} are both set. Preferring source-${suffix}. Please stop setting ${legacyPrefix}-${suffix}.`);
		return preferredInput;
	} else if (legacyInput) {
		actionsCore.warning(`The legacy option ${legacyPrefix}-${suffix} is set. Please migrate to source-${suffix}.`);
		return legacyInput;
	} else return preferredInput;
}

//#endregion
//#region src/index.ts
const pkgVersion = "1.0";
const EVENT_BACKTRACES = "backtrace";
const EVENT_EXCEPTION = "exception";
const EVENT_ARTIFACT_CACHE_HIT = "artifact_cache_hit";
const EVENT_ARTIFACT_CACHE_MISS = "artifact_cache_miss";
const EVENT_ARTIFACT_CACHE_PERSIST = "artifact_cache_persist";
const EVENT_PREFLIGHT_REQUIRE_NIX_DENIED = "preflight-require-nix-denied";
const EVENT_STORE_IDENTITY_FAILED = "store_identity_failed";
const FACT_ARTIFACT_FETCHED_FROM_CACHE = "artifact_fetched_from_cache";
const FACT_ENDED_WITH_EXCEPTION = "ended_with_exception";
const FACT_FINAL_EXCEPTION = "final_exception";
const FACT_OS = "$os";
const FACT_OS_VERSION = "$os_version";
const FACT_SOURCE_URL = "source_url";
const FACT_SOURCE_URL_ETAG = "source_url_etag";
const FACT_NIX_VERSION = "nix_version";
const FACT_NIX_LOCATION = "nix_location";
const FACT_NIX_STORE_TRUST = "nix_store_trusted";
const FACT_NIX_STORE_VERSION = "nix_store_version";
const FACT_NIX_STORE_CHECK_METHOD = "nix_store_check_method";
const FACT_NIX_STORE_CHECK_ERROR = "nix_store_check_error";
const STATE_KEY_EXECUTION_PHASE = "detsys_action_execution_phase";
const STATE_KEY_NIX_NOT_FOUND = "detsys_action_nix_not_found";
const STATE_NOT_FOUND = "not-found";
const STATE_KEY_CROSS_PHASE_ID = "detsys_cross_phase_id";
const STATE_BACKTRACE_START_TIMESTAMP = "detsys_backtrace_start_timestamp";
const DIAGNOSTIC_ENDPOINT_TIMEOUT_MS = 1e4;
const CHECK_IN_ENDPOINT_TIMEOUT_MS = 1e3;
const PROGRAM_NAME_CRASH_DENY_LIST = [
	"nix-expr-tests",
	"nix-store-tests",
	"nix-util-tests"
];
const determinateStateDir = "/var/lib/determinate";
const determinateIdentityFile = path.join(determinateStateDir, "identity.json");
const isRoot = os$1.userInfo().uid === 0;
/** Create the Determinate state directory by escalating via sudo */
async function sudoEnsureDeterminateStateDir() {
	const code = await exec$1.exec("sudo", [
		"mkdir",
		"-p",
		determinateStateDir
	]);
	if (code !== 0) throw new Error(`sudo mkdir -p exit: ${code}`);
}
/** Ensures the Determinate state directory exists, escalating if necessary */
async function ensureDeterminateStateDir() {
	if (isRoot) await mkdir(determinateStateDir, { recursive: true });
	else return sudoEnsureDeterminateStateDir();
}
/** Writes correlation hashes to the Determinate state directory by writing to a `sudo tee` pipe */
async function sudoWriteCorrelationHashes(hashes) {
	const buffer = Buffer.from(hashes);
	const code = await exec$1.exec("sudo", ["tee", determinateIdentityFile], {
		input: buffer,
		outStream: createWriteStream("/dev/null")
	});
	if (code !== 0) throw new Error(`sudo tee exit: ${code}`);
}
/** Writes correlation hashes to the Determinate state directory, escalating if necessary */
async function writeCorrelationHashes(hashes) {
	await ensureDeterminateStateDir();
	if (isRoot) await fs.writeFile(determinateIdentityFile, hashes, "utf-8");
	else return sudoWriteCorrelationHashes(hashes);
}
var DetSysAction = class {
	determineExecutionPhase() {
		if (actionsCore.getState(STATE_KEY_EXECUTION_PHASE) === "") {
			actionsCore.saveState(STATE_KEY_EXECUTION_PHASE, "post");
			return "main";
		} else return "post";
	}
	constructor(actionOptions) {
		this.actionOptions = makeOptionsConfident(actionOptions);
		this.idsHost = new IdsHost(this.actionOptions.idsProjectName, actionOptions.diagnosticsSuffix, process.env["INPUT_DIAGNOSTIC-ENDPOINT"]);
		this.exceptionAttachments = /* @__PURE__ */ new Map();
		this.nixStoreTrust = "unknown";
		this.strictMode = getBool("_internal-strict-mode");
		if (getBoolOrUndefined("_internal-obliterate-actions-id-token-request-variables") === true) {
			process.env["ACTIONS_ID_TOKEN_REQUEST_URL"] = void 0;
			process.env["ACTIONS_ID_TOKEN_REQUEST_TOKEN"] = void 0;
		}
		this.features = {};
		this.featureEventMetadata = {};
		this.events = [];
		this.getCrossPhaseId();
		this.collectBacktraceSetup();
		this.facts = {
			$lib: "idslib",
			$lib_version: pkgVersion,
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
			if (value) this.facts[target] = value;
		}
		this.identity = identify();
		this.archOs = getArchOs();
		this.nixSystem = getNixPlatform(this.archOs);
		this.facts.$app_name = `${this.actionOptions.name}/action`;
		this.facts.arch_os = this.archOs;
		this.facts.nix_system = this.nixSystem;
		getDetails().then((details) => {
			if (details.name !== "unknown") this.addFact(FACT_OS, details.name);
			if (details.version !== "unknown") this.addFact(FACT_OS_VERSION, details.version);
		}).catch((e) => {
			actionsCore.debug(`Failure getting platform details: ${stringifyError$1(e)}`);
		});
		this.executionPhase = this.determineExecutionPhase();
		this.facts.execution_phase = this.executionPhase;
		if (this.actionOptions.fetchStyle === "gh-env-style") this.architectureFetchSuffix = this.archOs;
		else if (this.actionOptions.fetchStyle === "nix-style") this.architectureFetchSuffix = this.nixSystem;
		else if (this.actionOptions.fetchStyle === "universal") this.architectureFetchSuffix = "universal";
		else throw new Error(`fetchStyle ${this.actionOptions.fetchStyle} is not a valid style`);
		this.sourceParameters = constructSourceParameters(this.actionOptions.legacySourcePrefix);
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
		this.executeAsync().catch((error) => {
			console.log(error);
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
		return this.identity.github_workflow_run_differentiator_hash || process.env.RUNNER_TRACKING_ID || randomUUID();
	}
	getCrossPhaseId() {
		let crossPhaseId = actionsCore.getState(STATE_KEY_CROSS_PHASE_ID);
		if (crossPhaseId === "") {
			crossPhaseId = randomUUID();
			actionsCore.saveState(STATE_KEY_CROSS_PHASE_ID, crossPhaseId);
		}
		return crossPhaseId;
	}
	getCorrelationHashes() {
		return this.identity;
	}
	recordEvent(eventName, context = {}) {
		const prefixedName = eventName === "$feature_flag_called" ? eventName : `${this.actionOptions.eventPrefix}${eventName}`;
		this.events.push({
			name: prefixedName,
			distinct_id: this.identity.$anon_distinct_id,
			uuid: randomUUID(),
			timestamp: /* @__PURE__ */ new Date(),
			properties: {
				...context,
				...this.identity,
				...this.facts,
				...Object.fromEntries(Object.entries(this.featureEventMetadata).map(([name, variant]) => [`$feature/${name}`, variant]))
			}
		});
	}
	/**
	* Unpacks the closure returned by `fetchArtifact()`, imports the
	* contents into the Nix store, and returns the path of the executable at
	* `/nix/store/STORE_PATH/bin/${bin}`.
	*/
	async unpackClosure(bin) {
		const artifact = await this.fetchArtifact();
		const { stdout } = await promisify(exec)(`cat "${artifact}" | xz -d | nix-store --import`);
		return `${stdout.split(os$1.EOL).at(-2)}/bin/${bin}`;
	}
	/**
	* Fetches the executable at the URL determined by the `source-*` inputs and
	* other facts, `chmod`s it, and returns the path to the executable on disk.
	*/
	async fetchExecutable() {
		const binaryPath = await this.fetchArtifact();
		await chmod(binaryPath, constants.S_IXUSR | constants.S_IXGRP);
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
			await this.checkIn();
			const correlationHashes = JSON.stringify(this.getCorrelationHashes());
			process.env.DETSYS_CORRELATION = correlationHashes;
			try {
				await writeCorrelationHashes(correlationHashes);
			} catch (error) {
				this.recordEvent(EVENT_STORE_IDENTITY_FAILED, { error: String(error) });
			}
			if (!await this.preflightRequireNix()) {
				this.recordEvent(EVENT_PREFLIGHT_REQUIRE_NIX_DENIED);
				return;
			} else {
				await this.preflightNixStoreInfo();
				await this.preflightNixVersion();
				this.addFact(FACT_NIX_STORE_TRUST, this.nixStoreTrust);
			}
			if (this.isMain) {
				await this.main();
				await this.preflightNixVersion();
			} else if (this.isPost) await this.post();
			this.addFact(FACT_ENDED_WITH_EXCEPTION, false);
		} catch (e) {
			this.addFact(FACT_ENDED_WITH_EXCEPTION, true);
			const reportable = stringifyError$1(e);
			this.addFact(FACT_FINAL_EXCEPTION, reportable);
			if (this.isPost) actionsCore.warning(reportable);
			else actionsCore.setFailed(reportable);
			const doGzip = promisify(gzip);
			const exceptionContext = /* @__PURE__ */ new Map();
			for (const [attachmentLabel, filePath] of this.exceptionAttachments) try {
				const logText = readFileSync(filePath);
				const buf = await doGzip(logText);
				exceptionContext.set(`staple_value_${attachmentLabel}`, buf.toString("base64"));
			} catch (innerError) {
				exceptionContext.set(`staple_failure_${attachmentLabel}`, stringifyError$1(innerError));
			}
			this.recordEvent(EVENT_EXCEPTION, Object.fromEntries(exceptionContext));
		} finally {
			if (this.isPost) await this.collectBacktraces();
			await this.complete();
		}
	}
	async getClient() {
		return await this.idsHost.getGot((incitingError, prevUrl, nextUrl) => {
			this.recordPlausibleTimeout(incitingError);
			this.recordEvent("ids-failover", {
				previousUrl: prevUrl.toString(),
				nextUrl: nextUrl.toString()
			});
		});
	}
	async checkIn() {
		const checkin = await this.requestCheckIn();
		if (checkin === void 0) return;
		this.features = checkin.options;
		for (const [key, feature] of Object.entries(this.features)) this.featureEventMetadata[key] = feature.variant;
		const impactSymbol = new Map([
			["none", "⚪"],
			["maintenance", "🛠️"],
			["minor", "🟡"],
			["major", "🟠"],
			["critical", "🔴"]
		]);
		const defaultImpactSymbol = "🔵";
		if (checkin.status !== null) {
			const summaries = [];
			for (const incident of checkin.status.incidents) summaries.push(`${impactSymbol.get(incident.impact) || defaultImpactSymbol} ${incident.status.replace("_", " ")}: ${incident.name} (${incident.shortlink})`);
			for (const maintenance of checkin.status.scheduled_maintenances) summaries.push(`${impactSymbol.get(maintenance.impact) || defaultImpactSymbol} ${maintenance.status.replace("_", " ")}: ${maintenance.name} (${maintenance.shortlink})`);
			if (summaries.length > 0) {
				actionsCore.info(`[0;31m[1m[4m${checkin.status.page.name} Status`);
				for (const notice of summaries) actionsCore.info(notice);
				actionsCore.info(`See: ${checkin.status.page.url}`);
				actionsCore.info(``);
			}
		}
	}
	getFeature(name) {
		if (!this.features.hasOwnProperty(name)) return;
		const result = this.features[name];
		if (result === void 0) return;
		this.recordEvent("$feature_flag_called", {
			$feature_flag: name,
			$feature_flag_response: result.variant
		});
		return result;
	}
	/**
	* Check in to install.determinate.systems, to accomplish three things:
	*
	* 1. Preflight the server selected from IdsHost, to increase the chances of success.
	* 2. Fetch any incidents and maintenance events to let users know in case things are weird.
	* 3. Get feature flag data so we can gently roll out new features.
	*/
	async requestCheckIn() {
		for (let attemptsRemaining = 5; attemptsRemaining > 0; attemptsRemaining--) {
			const checkInUrl = await this.getCheckInUrl();
			if (checkInUrl === void 0) return;
			try {
				actionsCore.debug(`Preflighting via ${checkInUrl}`);
				const props = {
					distinct_id: this.identity.$anon_distinct_id,
					anon_distinct_id: this.identity.$anon_distinct_id,
					groups: this.identity.$groups,
					person_properties: {
						ci: "github",
						...this.identity,
						...this.facts
					}
				};
				return await (await this.getClient()).post(checkInUrl, {
					json: props,
					timeout: { request: CHECK_IN_ENDPOINT_TIMEOUT_MS }
				}).json();
			} catch (e) {
				this.recordPlausibleTimeout(e);
				actionsCore.debug(`Error checking in: ${stringifyError$1(e)}`);
				this.idsHost.markCurrentHostBroken();
			}
		}
	}
	recordPlausibleTimeout(e) {
		if (e instanceof TimeoutError && "timings" in e && "request" in e) {
			const reportContext = {
				url: e.request.requestUrl?.toString(),
				retry_count: e.request.retryCount
			};
			for (const [key, value] of Object.entries(e.timings.phases)) if (Number.isFinite(value)) reportContext[`timing_phase_${key}`] = value;
			this.recordEvent("timeout", reportContext);
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
			actionsCore.debug(`Using the provided source binary at ${sourceBinary}`);
			return sourceBinary;
		}
		actionsCore.startGroup(`Downloading ${this.actionOptions.name} for ${this.architectureFetchSuffix}`);
		try {
			actionsCore.info(`Fetching from ${await this.getSourceUrl()}`);
			const correlatedUrl = await this.getSourceUrl();
			correlatedUrl.searchParams.set("ci", "github");
			correlatedUrl.searchParams.set("correlation", JSON.stringify(this.identity));
			const versionCheckup = await (await this.getClient()).head(correlatedUrl);
			if (versionCheckup.headers.etag) {
				const v = versionCheckup.headers.etag;
				this.addFact(FACT_SOURCE_URL_ETAG, v);
				actionsCore.debug(`Checking the tool cache for ${await this.getSourceUrl()} at ${v}`);
				const cached = await this.getCachedVersion(v);
				if (cached) {
					this.facts[FACT_ARTIFACT_FETCHED_FROM_CACHE] = true;
					actionsCore.debug(`Tool cache hit.`);
					return cached;
				}
			}
			this.facts[FACT_ARTIFACT_FETCHED_FROM_CACHE] = false;
			actionsCore.debug(`No match from the cache, re-fetching from the redirect: ${versionCheckup.url}`);
			const destFile = this.getTemporaryName();
			const fetchStream = await this.downloadFile(new URL(versionCheckup.url), destFile);
			if (fetchStream.response?.headers.etag) {
				const v = fetchStream.response.headers.etag;
				try {
					await this.saveCachedVersion(v, destFile);
				} catch (e) {
					actionsCore.debug(`Error caching the artifact: ${stringifyError$1(e)}`);
				}
			}
			return destFile;
		} catch (e) {
			this.recordPlausibleTimeout(e);
			throw e;
		} finally {
			actionsCore.endGroup();
		}
	}
	/**
	* A helper function for failing on error only if strict mode is enabled.
	* This is intended only for CI environments testing Actions themselves.
	*/
	failOnError(msg) {
		if (this.strictMode) actionsCore.setFailed(`strict mode failure: ${msg}`);
	}
	async downloadFile(url, destination) {
		const client = await this.getClient();
		return new Promise((resolve, reject) => {
			let writeStream;
			let failed = false;
			const retry = (stream) => {
				if (writeStream) writeStream.destroy();
				writeStream = createWriteStream(destination, {
					encoding: "binary",
					mode: 493
				});
				writeStream.once("error", (error) => {
					failed = true;
					reject(error);
				});
				writeStream.on("finish", () => {
					if (!failed) resolve(stream);
				});
				stream.once("retry", (_count, _error, createRetryStream) => {
					retry(createRetryStream());
				});
				stream.pipe(writeStream);
			};
			retry(client.stream(url));
		});
	}
	async complete() {
		this.recordEvent(`complete_${this.executionPhase}`);
		await this.submitEvents();
	}
	async getCheckInUrl() {
		const checkInUrl = await this.idsHost.getDynamicRootUrl();
		if (checkInUrl === void 0) return;
		checkInUrl.pathname += "check-in";
		return checkInUrl;
	}
	async getSourceUrl() {
		const p = this.sourceParameters;
		if (p.url) {
			this.addFact(FACT_SOURCE_URL, p.url);
			return new URL(p.url);
		}
		const fetchUrl = await this.idsHost.getRootUrl();
		fetchUrl.pathname += this.actionOptions.idsProjectName;
		if (p.tag) fetchUrl.pathname += `/tag/${p.tag}`;
		else if (p.pr) fetchUrl.pathname += `/pr/${p.pr}`;
		else if (p.branch) fetchUrl.pathname += `/branch/${p.branch}`;
		else if (p.revision) fetchUrl.pathname += `/rev/${p.revision}`;
		else fetchUrl.pathname += `/stable`;
		fetchUrl.pathname += `/${this.architectureFetchSuffix}`;
		this.addFact(FACT_SOURCE_URL, fetchUrl.toString());
		return fetchUrl;
	}
	cacheKey(version) {
		const cleanedVersion = version.replace(/[^a-zA-Z0-9-+.]/g, "");
		return `determinatesystem-${this.actionOptions.name}-${this.architectureFetchSuffix}-${cleanedVersion}`;
	}
	async getCachedVersion(version) {
		const startCwd = process.cwd();
		try {
			const tempDir = this.getTemporaryName();
			await mkdir(tempDir);
			process.chdir(tempDir);
			process.env.GITHUB_WORKSPACE_BACKUP = process.env.GITHUB_WORKSPACE;
			delete process.env.GITHUB_WORKSPACE;
			if (await actionsCache.restoreCache([this.actionOptions.name], this.cacheKey(version), [], void 0, true)) {
				this.recordEvent(EVENT_ARTIFACT_CACHE_HIT);
				return `${tempDir}/${this.actionOptions.name}`;
			}
			this.recordEvent(EVENT_ARTIFACT_CACHE_MISS);
			return;
		} finally {
			process.env.GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE_BACKUP;
			delete process.env.GITHUB_WORKSPACE_BACKUP;
			process.chdir(startCwd);
		}
	}
	async saveCachedVersion(version, toolPath) {
		const startCwd = process.cwd();
		try {
			const tempDir = this.getTemporaryName();
			await mkdir(tempDir);
			process.chdir(tempDir);
			await copyFile(toolPath, `${tempDir}/${this.actionOptions.name}`);
			process.env.GITHUB_WORKSPACE_BACKUP = process.env.GITHUB_WORKSPACE;
			delete process.env.GITHUB_WORKSPACE;
			await actionsCache.saveCache([this.actionOptions.name], this.cacheKey(version), void 0, true);
			this.recordEvent(EVENT_ARTIFACT_CACHE_PERSIST);
		} finally {
			process.env.GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE_BACKUP;
			delete process.env.GITHUB_WORKSPACE_BACKUP;
			process.chdir(startCwd);
		}
	}
	collectBacktraceSetup() {
		if (!process.env.DETSYS_BACKTRACE_COLLECTOR) {
			actionsCore.exportVariable("DETSYS_BACKTRACE_COLLECTOR", this.getCrossPhaseId());
			actionsCore.saveState(STATE_BACKTRACE_START_TIMESTAMP, Date.now());
		}
	}
	async collectBacktraces() {
		try {
			if (process.env.DETSYS_BACKTRACE_COLLECTOR !== this.getCrossPhaseId()) return;
			const backtraces = await collectBacktraces(this.actionOptions.binaryNamePrefixes, this.actionOptions.binaryNamesDenyList, parseInt(actionsCore.getState(STATE_BACKTRACE_START_TIMESTAMP)));
			actionsCore.debug(`Backtraces identified: ${backtraces.size}`);
			if (backtraces.size > 0) this.recordEvent(EVENT_BACKTRACES, Object.fromEntries(backtraces));
		} catch (innerError) {
			actionsCore.debug(`Error collecting backtraces: ${stringifyError$1(innerError)}`);
		}
	}
	async preflightRequireNix() {
		let nixLocation;
		const pathParts = (process.env["PATH"] || "").split(":");
		for (const location of pathParts) {
			const candidateNix = path.join(location, "nix");
			try {
				await fs.access(candidateNix, fs.constants.X_OK);
				actionsCore.debug(`Found Nix at ${candidateNix}`);
				nixLocation = candidateNix;
				break;
			} catch {
				actionsCore.debug(`Nix not at ${candidateNix}`);
			}
		}
		this.addFact(FACT_NIX_LOCATION, nixLocation || "");
		if (this.actionOptions.requireNix === "ignore") return true;
		if (actionsCore.getState(STATE_KEY_NIX_NOT_FOUND) === STATE_NOT_FOUND) return false;
		if (nixLocation !== void 0) return true;
		actionsCore.saveState(STATE_KEY_NIX_NOT_FOUND, STATE_NOT_FOUND);
		switch (this.actionOptions.requireNix) {
			case "fail":
				actionsCore.setFailed(["This action can only be used when Nix is installed.", "Add `- uses: DeterminateSystems/determinate-nix-action@v3` earlier in your workflow."].join(" "));
				break;
			case "warn":
				actionsCore.warning(["This action is in no-op mode because Nix is not installed.", "Add `- uses: DeterminateSystems/determinate-nix-action@v3` earlier in your workflow."].join(" "));
				break;
		}
		return false;
	}
	async preflightNixStoreInfo() {
		let output = "";
		const options = {};
		options.silent = true;
		options.listeners = { stdout: (data) => {
			output += data.toString();
		} };
		try {
			output = "";
			await exec$1.exec("nix", [
				"store",
				"info",
				"--json"
			], options);
			this.addFact(FACT_NIX_STORE_CHECK_METHOD, "info");
		} catch {
			try {
				output = "";
				await exec$1.exec("nix", [
					"store",
					"ping",
					"--json"
				], options);
				this.addFact(FACT_NIX_STORE_CHECK_METHOD, "ping");
			} catch {
				this.addFact(FACT_NIX_STORE_CHECK_METHOD, "none");
				return;
			}
		}
		try {
			const parsed = JSON.parse(output);
			if (parsed.trusted === 1) this.nixStoreTrust = "trusted";
			else if (parsed.trusted === 0) this.nixStoreTrust = "untrusted";
			else if (parsed.trusted !== void 0) this.addFact(FACT_NIX_STORE_CHECK_ERROR, `Mysterious trusted value: ${JSON.stringify(parsed.trusted)}`);
			this.addFact(FACT_NIX_STORE_VERSION, JSON.stringify(parsed.version));
		} catch (e) {
			this.addFact(FACT_NIX_STORE_CHECK_ERROR, stringifyError$1(e));
		}
	}
	async preflightNixVersion() {
		let output = "unknown";
		try {
			({stdout: output} = await exec$1.getExecOutput("nix", ["--version"], { silent: true }));
			output = output.trim() || "unknown";
		} catch {}
		this.addFact(FACT_NIX_VERSION, output);
	}
	async submitEvents() {
		const diagnosticsUrl = await this.idsHost.getDiagnosticsUrl();
		if (diagnosticsUrl === void 0) {
			actionsCore.debug("Diagnostics are disabled. Not sending the following events:");
			actionsCore.debug(JSON.stringify(this.events, void 0, 2));
			return;
		}
		const batch = {
			sent_at: /* @__PURE__ */ new Date(),
			batch: this.events
		};
		try {
			await (await this.getClient()).post(diagnosticsUrl, {
				json: batch,
				timeout: { request: DIAGNOSTIC_ENDPOINT_TIMEOUT_MS }
			});
		} catch (err) {
			this.recordPlausibleTimeout(err);
			actionsCore.debug(`Error submitting diagnostics event to ${diagnosticsUrl}: ${stringifyError$1(err)}`);
		}
		this.events = [];
	}
};
function stringifyError$1(error) {
	return error instanceof Error || typeof error == "string" ? error.toString() : JSON.stringify(error);
}
function makeOptionsConfident(actionOptions) {
	const idsProjectName = actionOptions.idsProjectName ?? actionOptions.name;
	const finalOpts = {
		name: actionOptions.name,
		idsProjectName,
		eventPrefix: actionOptions.eventPrefix || "action:",
		fetchStyle: actionOptions.fetchStyle,
		legacySourcePrefix: actionOptions.legacySourcePrefix,
		requireNix: actionOptions.requireNix,
		binaryNamePrefixes: actionOptions.binaryNamePrefixes ?? [
			"nix",
			"determinate-nixd",
			actionOptions.name
		],
		binaryNamesDenyList: actionOptions.binaryNamePrefixes ?? PROGRAM_NAME_CRASH_DENY_LIST
	};
	actionsCore.debug("idslib options:");
	actionsCore.debug(JSON.stringify(finalOpts, void 0, 2));
	return finalOpts;
}

//#endregion
export { DetSysAction, IdsHost, inputs_exports as inputs, platform_exports as platform, stringifyError };
//# sourceMappingURL=index.js.map
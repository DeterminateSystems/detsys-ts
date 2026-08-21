import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import * as nodeFs from "node:fs";
import fs, { createReadStream } from "node:fs";
import os, { tmpdir } from "node:os";
import { promisify } from "node:util";
import * as actionsCore from "@actions/core";
import * as exec$1 from "@actions/exec";
import os$1 from "os";
import fs$1, { chmod, copyFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import * as otelApi from "@opentelemetry/api";
import { SeverityNumber, logs } from "@opentelemetry/api-logs";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import * as otelCore from "@opentelemetry/core";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import * as otelResources from "@opentelemetry/resources";
import * as sdkLogs from "@opentelemetry/sdk-logs";
import * as sdkTrace from "@opentelemetry/sdk-trace-base";
import * as semconv from "@opentelemetry/semantic-conventions";
import got, { TimeoutError } from "got";
import { resolveSrv } from "node:dns/promises";
import * as actionsCache from "@actions/cache";
import * as semconvIncubating from "@opentelemetry/semantic-conventions/incubating";
import { exec } from "node:child_process";
import path from "node:path";
//#region src/linux-release-info.ts
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
const readFileAsync = promisify(fs.readFile);
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
	if (os.type() !== "Linux") {
		if (options.mode === "sync") return getOsInfo();
		else return Promise.resolve(getOsInfo());
	}
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
		type: os.type(),
		platform: os.platform(),
		hostname: os.hostname(),
		arch: os.arch(),
		release: os.release()
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
		fileData = fs.readFileSync(osReleaseFile, "binary");
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
const platform = os$1.platform();
/**
* The Action runner's architecture.
*/
const arch = os$1.arch();
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
/**
* @packageDocumentation
* Collects backtraces for executables for diagnostics
*/
const START_SLOP_SECONDS = 5;
async function collectBacktraces(prefixes, programNameDenyList, startTimestampMs) {
	if (isMacOS) return await collectBacktracesMacOS(prefixes, programNameDenyList, startTimestampMs);
	if (isLinux) return await collectBacktracesSystemd(prefixes, programNameDenyList, startTimestampMs);
	return [];
}
async function collectBacktracesMacOS(prefixes, programNameDenyList, startTimestampMs) {
	const backtraces = [];
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
		for (const fileName of fileNames) try {
			if ((await stat(`${dir}/${fileName}`)).ctimeMs >= startTimestampMs) backtraces.push({
				id: fileName,
				source,
				report: await readFile(`${dir}/${fileName}`, "utf-8")
			});
		} catch (innerError) {
			backtraces.push({
				id: fileName,
				source,
				error: stringifyError(innerError)
			});
		}
	}
	return backtraces;
}
async function collectBacktracesSystemd(prefixes, programNameDenyList, startTimestampMs) {
	const sinceSeconds = Math.ceil((Date.now() - startTimestampMs) / 1e3) + START_SLOP_SECONDS;
	const backtraces = [];
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
			if (keys.includes("exe") && keys.includes("pid")) {
				if (typeof sussyObject.exe == "string" && typeof sussyObject.pid == "number") {
					const execParts = sussyObject.exe.split("/");
					const binaryName = execParts[execParts.length - 1];
					if (prefixes.some((prefix) => binaryName.startsWith(prefix)) && !programNameDenyList.includes(binaryName)) coredumps.push({
						exe: sussyObject.exe,
						pid: sussyObject.pid
					});
				} else actionsCore.debug(`Mysterious coredump entry missing exe string and/or pid number: ${JSON.stringify(sussyObject)}`);
			} else actionsCore.debug(`Mysterious coredump entry missing exe value and/or pid value: ${JSON.stringify(sussyObject)}`);
		}
	} catch (innerError) {
		actionsCore.debug(`Cannot collect backtraces: ${stringifyError(innerError)}`);
		return backtraces;
	}
	for (const coredump of coredumps) try {
		const { stdout: report } = await exec$1.getExecOutput("coredumpctl", ["info", `${coredump.pid}`], { silent: true });
		backtraces.push({
			id: `${coredump.pid}`,
			source: "coredumpctl",
			program: coredump.exe,
			report
		});
	} catch (innerError) {
		backtraces.push({
			id: `${coredump.pid}`,
			source: "coredumpctl",
			program: coredump.exe,
			error: stringifyError(innerError)
		});
	}
	return backtraces;
}
//#endregion
//#region src/checksums.ts
/**
* @packageDocumentation
* Parsing and hashing helpers for `shasum`-format checksum files, used to
* hash-lock downloaded artifacts.
*/
const HEX_STRING_RE = /^[0-9a-fA-F]+$/;
/**
* Parse a `shasum`-format checksums file into a map of filename -> hex digest.
*
* Each non-empty line has the shape `<hex-digest><space(s)><filename>`. Lines
* without a space delimiter are skipped. Invalid hex digests throw, so a
* malformed file fails loudly rather than silently skipping the entry we
* care about.
*/
function parseChecksumsFile(text) {
	const result = /* @__PURE__ */ new Map();
	for (const record of text.split(/\r\n|\n|\r/).filter(Boolean)) {
		const delimIndex = record.indexOf(" ");
		if (delimIndex === -1) continue;
		const digest = record.slice(0, delimIndex);
		if (!HEX_STRING_RE.test(digest)) throw new Error(`Invalid digest in checksums file: ${digest}`);
		const name = record.slice(delimIndex + 1).trim();
		if (name === "") continue;
		result.set(name, digest.toLowerCase());
	}
	return result;
}
/**
* Compute the SHA-256 of a file on disk and return its lowercase hex digest.
* Streams the file so memory use is constant regardless of size.
*/
async function sha256OfFile(filePath) {
	return new Promise((resolve, reject) => {
		const hash = createHash("sha256").setEncoding("hex");
		createReadStream(filePath).once("error", reject).pipe(hash).once("finish", () => resolve(hash.read()));
	});
}
/**
* Compute the SHA-256 of an in-memory buffer or string and return its
* lowercase hex digest.
*/
function sha256OfBuffer(data) {
	return createHash("sha256").update(data).digest("hex");
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
		if (value === void 0) {
			if (OPTIONAL_VARIABLES.includes(varName)) {
				actionsCore.debug(`Optional environment variable not set: ${varName} -- substituting with the variable name`);
				value = varName;
			} else {
				actionsCore.debug(`Environment variable not set: ${varName} -- can't generate the requested identity`);
				return;
			}
		}
		hash.update(value);
		hash.update("\0");
	}
	return `${prefix}-${hash.digest("hex")}`;
}
//#endregion
//#region src/telemetry.ts
/**
* @packageDocumentation
* OpenTelemetry traces and logs for Determinate Systems' GitHub Actions.
*
* The OpenTelemetry API is a no-op until a provider is registered globally.
* That means instrumentation call sites -- spans, log records -- can be
* written unconditionally: when export is disabled they cost nothing and no
* branching is needed at the call site.
*
* The SDK configures itself from the standard `OTEL_*` environment variables.
* This module only supplies defaults for the variables the user has not set,
* so every documented OpenTelemetry knob works here as it does anywhere else.
*/
/** The instrumentation scope name for everything this library emits. */
const SCOPE_NAME = "detsys-ts";
/**
* The OTLP/HTTP collector for all Actions.
* The exporters add `/v1/traces` and `/v1/logs` to this URL.
*
* This collector is a fixed service.
* It is not one of the install.determinate.systems backends.
* Thus it does not use their SRV failover.
*/
const DEFAULT_OTLP_ENDPOINT = "https://otel.determinate.systems";
/**
* The token for {@link DEFAULT_OTLP_ENDPOINT}.
* The exporters send it as `Authorization: Bearer <token>`.
* That is the default scheme of the collector's `bearertokenauth` extension.
*
* This token is public.
* It ships in `dist/`, on npm, and in each workflow that uses this library.
* It permits telemetry writes and no other operation.
* Change it in the collector configuration and in this file at the same time.
*/
const OTLP_INGEST_TOKEN = "8bfa2d8b689352981286f0149c4e55cc0dff30a4f7a735b560e31479904a74e1";
/**
* How long to wait for buffered spans and logs to reach the collector before
* giving up. The Action's process exits immediately afterward, so this is a
* hard ceiling on how much a slow collector can delay a workflow.
*/
const SHUTDOWN_TIMEOUT_MS = 5e3;
/**
* The default for `OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT`.
*
* The SDK's own default is unlimited. Attributes here can carry pasted
* command output and other unbounded text, which the collector should not
* have to absorb, so cap them. File-sized payloads go out as log records
* instead: a log record's body is not an attribute and is not truncated.
*/
const DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT = 8192;
/** The OTLP environment variables a child process inherits from this run. */
const OTLP_EXPORT_VARIABLES = [
	"OTEL_EXPORTER_OTLP_ENDPOINT",
	"OTEL_EXPORTER_OTLP_HEADERS",
	"OTEL_EXPORTER_OTLP_COMPRESSION"
];
/**
* Our own propagator instance, rather than the global one.
*
* The global propagator only exists once {@link Telemetry.start} has
* registered it, which would make traceparent handling silently depend on
* start-up ordering. Owning an instance keeps {@link traceparentOf} and {@link
* contextFromTraceparent} correct no matter when they're called.
*/
const PROPAGATOR = new otelCore.W3CTraceContextPropagator();
const SEVERITY = {
	debug: SeverityNumber.DEBUG,
	info: SeverityNumber.INFO,
	notice: SeverityNumber.INFO2,
	warning: SeverityNumber.WARN,
	error: SeverityNumber.ERROR
};
/**
* Whether this run exports telemetry at all.
*
* `OTEL_SDK_DISABLED=true` is the standard way to turn the export off. An
* empty `OTEL_EXPORTER_OTLP_ENDPOINT` does the same, which is what this
* library documented before `OTEL_SDK_DISABLED` was in the specification.
*/
function exportEnabled() {
	if (otelCore.getBooleanFromEnv("OTEL_SDK_DISABLED")) return false;
	const endpoint = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];
	if (endpoint !== void 0 && endpoint.trim() === "") return false;
	return true;
}
/**
* Fill in the `OTEL_*` variables this run needs and the user has not set.
*
* From here on the exporters read their whole configuration from the
* environment, exactly as they would in any other OpenTelemetry program.
* Child processes inherit the same variables, so their telemetry reaches the
* same collector without any further arrangement.
*/
function applyOtlpEnvironmentDefaults() {
	if (otelCore.getStringFromEnv("OTEL_EXPORTER_OTLP_ENDPOINT") === void 0) process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = DEFAULT_OTLP_ENDPOINT;
	if (exportsToDefaultCollector()) {
		const headers = otelCore.parseKeyPairsIntoRecord(otelCore.getStringFromEnv("OTEL_EXPORTER_OTLP_HEADERS"));
		if (!Object.keys(headers).some((name) => name.toLowerCase() === "authorization")) {
			headers["Authorization"] = `Bearer ${OTLP_INGEST_TOKEN}`;
			process.env["OTEL_EXPORTER_OTLP_HEADERS"] = encodeOtlpHeaders(headers);
		}
	}
	if (otelCore.getStringFromEnv("OTEL_EXPORTER_OTLP_COMPRESSION") === void 0) process.env["OTEL_EXPORTER_OTLP_COMPRESSION"] = "gzip";
	if (otelCore.getNumberFromEnv("OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT") === void 0) process.env["OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT"] = `${DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT}`;
}
/**
* Whether this run sends its data to {@link DEFAULT_OTLP_ENDPOINT}.
*
* Only that collector gets {@link OTLP_INGEST_TOKEN}. A collector the user
* chose must not receive our credentials.
*/
function exportsToDefaultCollector() {
	const endpoint = otelCore.getStringFromEnv("OTEL_EXPORTER_OTLP_ENDPOINT");
	if (endpoint === void 0) return false;
	try {
		return new URL(endpoint).toString() === new URL(DEFAULT_OTLP_ENDPOINT).toString();
	} catch {
		return false;
	}
}
/**
* The OTLP variables in the environment, for a child process that does not
* inherit ours.
*/
function otlpExportEnvironment() {
	const environment = {};
	for (const name of OTLP_EXPORT_VARIABLES) {
		const value = otelCore.getStringFromEnv(name);
		if (value !== void 0) environment[name] = value;
	}
	return environment;
}
/**
* Make the value of `OTEL_EXPORTER_OTLP_HEADERS`.
*
* The variable uses the W3C baggage format.
* The reader decodes each percent-encoded value.
* Thus you must encode the space in `Bearer <token>`.
* If you do not encode it, the scheme and the token become two entries.
*/
function encodeOtlpHeaders(headers) {
	return Object.entries(headers).map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`).join(",");
}
/**
* The generator of the trace and span IDs of this run.
*
* It makes random IDs, as the default generator does.
* It can also give one span an identity that you supply.
* That is how a span that one process announces starts in a different process.
* See {@link Telemetry.startAnnouncedSpan}.
*/
var PinnedIdGenerator = class {
	/** Give the next span this identity. */
	pin(traceId, spanId) {
		this.traceId = traceId;
		this.spanId = spanId;
	}
	/** Give each subsequent span a random identity again. */
	unpin() {
		this.traceId = void 0;
		this.spanId = void 0;
	}
	generateTraceId() {
		return this.traceId ?? randomHex(16);
	}
	generateSpanId() {
		return this.spanId ?? randomHex(8);
	}
};
/**
* Owns the OpenTelemetry SDK's lifecycle. Constructing this does nothing on
* its own; `start()` registers the global providers and `shutdown()` flushes
* whatever is buffered.
*/
var Telemetry = class {
	/** Whether OTLP export is actually running. */
	get enabled() {
		return this.tracerProvider !== void 0;
	}
	/**
	* Register the global tracer and logger providers.
	*
	* Safe to call at most once. If it throws, telemetry stays disabled and the
	* Action carries on: instrumentation degrades to the API's no-ops rather
	* than failing the workflow.
	*/
	start(options) {
		if (this.enabled || !exportEnabled()) return;
		try {
			applyOtlpEnvironmentDefaults();
			const resource = otelResources.defaultResource().merge(otelResources.resourceFromAttributes({
				[semconv.ATTR_SERVICE_NAME]: options.serviceName,
				...options.serviceVersion === void 0 ? {} : { [semconv.ATTR_SERVICE_VERSION]: options.serviceVersion },
				...options.resourceAttributes
			})).merge(otelResources.detectResources({ detectors: [otelResources.envDetector] }));
			this.idGenerator = new PinnedIdGenerator();
			this.tracerProvider = new sdkTrace.BasicTracerProvider({
				resource,
				idGenerator: this.idGenerator,
				spanProcessors: [new sdkTrace.BatchSpanProcessor(new OTLPTraceExporter())]
			});
			this.loggerProvider = new sdkLogs.LoggerProvider({
				resource,
				logRecordLimits: { attributeValueLengthLimit: otelCore.getNumberFromEnv("OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT") },
				processors: [new sdkLogs.BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })]
			});
			otelApi.context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
			otelApi.propagation.setGlobalPropagator(PROPAGATOR);
			otelApi.trace.setGlobalTracerProvider(this.tracerProvider);
			logs.setGlobalLoggerProvider(this.loggerProvider);
			actionsCore.debug(`OpenTelemetry export enabled to ${otelCore.getStringFromEnv("OTEL_EXPORTER_OTLP_ENDPOINT")}`);
		} catch (e) {
			this.tracerProvider = void 0;
			this.loggerProvider = void 0;
			this.idGenerator = void 0;
			actionsCore.debug(`Failed to start OpenTelemetry export, continuing without it: ${stringifyError(e)}`);
		}
	}
	/**
	* Start the span that {@link newTraceparent} announced.
	*
	* A workflow job runs each Action as a process of its own.
	* Thus a span that covers more than one Action can only start in one of them.
	* The Action that announces such a span makes its identity known first, and
	* starts the span itself last, in the process that runs at the end.
	* The spans that already point at that identity then find their parent.
	*
	* The span starts at `startTime`, which is the moment of the announcement.
	* It is a child of the span in `parentContext`, and a root span if that
	* context holds no span.
	*
	* Returns undefined if the export is off, or if `traceparent` does not name a
	* usable span.
	*/
	startAnnouncedSpan(name, traceparent, startTime, parentContext = otelApi.ROOT_CONTEXT) {
		const generator = this.idGenerator;
		const spanContext = otelApi.trace.getSpanContext(contextFromTraceparent(traceparent));
		if (generator === void 0 || this.tracerProvider === void 0 || spanContext === void 0 || !otelApi.isSpanContextValid(spanContext)) return;
		const tracer = this.tracerProvider.getTracer(SCOPE_NAME, "1.0");
		try {
			generator.pin(spanContext.traceId, spanContext.spanId);
			return tracer.startSpan(name, { startTime }, parentContext);
		} finally {
			generator.unpin();
		}
	}
	/**
	* Flush buffered spans and logs and tear the SDK down.
	*
	* Never throws and never hangs: the Action calls this on its way out, so a
	* broken or slow collector must not be able to fail or stall the workflow.
	*/
	async shutdown() {
		const providers = [this.tracerProvider, this.loggerProvider].flatMap((p) => p ?? []);
		if (providers.length === 0) return;
		try {
			await withTimeout(Promise.all(providers.map(async (p) => p.shutdown())), SHUTDOWN_TIMEOUT_MS);
		} catch (e) {
			actionsCore.debug(`Error flushing OpenTelemetry data: ${stringifyError(e)}`);
		} finally {
			this.tracerProvider = void 0;
			this.loggerProvider = void 0;
			this.idGenerator = void 0;
		}
	}
};
/**
* The tracer for this library. Returns a no-op tracer until {@link
* Telemetry.start} has run, so this is always safe to call.
*/
function getTracer() {
	return otelApi.trace.getTracer(SCOPE_NAME, "1.0");
}
/**
* The logger for this library. Returns a no-op logger until {@link
* Telemetry.start} has run, so this is always safe to call.
*/
function getLogger() {
	return logs.getLogger(SCOPE_NAME, "1.0");
}
/**
* Emit a log record at `level`, correlated to whatever span is currently
* active.
*/
function emitLogRecord(level, message, attributes) {
	getLogger().emit({
		severityNumber: SEVERITY[level],
		severityText: level.toUpperCase(),
		body: message,
		attributes,
		context: otelApi.context.active()
	});
}
/**
* Serialize a span as a W3C `traceparent` header value, suitable for stashing
* in the Action's state or handing to a child process.
*
* Returns undefined when telemetry is disabled, since the no-op span's context
* is all zeroes and would not be a valid parent.
*/
function traceparentOf(span) {
	if (span === void 0 || !otelApi.isSpanContextValid(span.spanContext())) return;
	const carrier = {};
	PROPAGATOR.inject(otelApi.trace.setSpan(otelApi.ROOT_CONTEXT, span), carrier, otelApi.defaultTextMapSetter);
	return carrier["traceparent"];
}
/**
* Make the identity of a span, but do not start the span.
*
* Announce the result to whatever must point at the span before it starts:
* a different process, or a request this process makes too early to record.
* Start the span itself with {@link Telemetry.startAnnouncedSpan}.
*
* The span is in the trace of `parent`, or in a new trace of its own if there
* is no usable parent.
* A new trace is sampled, because a process that only forwards an identity
* cannot ask the sampler, and an unsampled parent would discard the work of
* each process that joins.
*/
function newTraceparent(parent) {
	const parentContext = otelApi.trace.getSpanContext(contextFromTraceparent(parent));
	if (parentContext !== void 0 && otelApi.isSpanContextValid(parentContext)) {
		const flags = parentContext.traceFlags.toString(16).padStart(2, "0");
		return `00-${parentContext.traceId}-${randomHex(8)}-${flags}`;
	}
	return `00-${randomHex(16)}-${randomHex(8)}-01`;
}
/**
* The W3C trace context headers of the operation in progress, for an outgoing
* HTTP request.
*
* Put these headers on the request.
* The service that answers it can then put its own work in this trace.
*
* The headers describe the span that is active now.
* When no span is active yet -- a request the Action makes before it starts a
* span of its own -- they describe the span that `$TRACEPARENT` names, which is
* the span the Action announced, or the span of the workflow job.
*
* The result is empty when the export is off.
* A no-op span's context is all zeroes, and is not a valid parent.
*/
function traceContextHeaders() {
	const active = otelApi.context.active();
	const context = otelApi.trace.getSpanContext(active) === void 0 ? contextFromTraceparent(process.env["TRACEPARENT"]) : active;
	const carrier = {};
	PROPAGATOR.inject(context, carrier, otelApi.defaultTextMapSetter);
	return carrier;
}
/**
* Rebuild a Context from a W3C `traceparent` value, so a span started in one
* process can parent spans started in another. Falls back to the root context
* when `traceparent` is absent or unparseable.
*/
function contextFromTraceparent(traceparent) {
	if (traceparent === void 0 || traceparent === "") return otelApi.ROOT_CONTEXT;
	return PROPAGATOR.extract(otelApi.ROOT_CONTEXT, { traceparent }, otelApi.defaultTextMapGetter);
}
/**
* Mark `span` as failed and attach the exception to it.
*/
function recordSpanError(span, error) {
	span.recordException(error instanceof Error ? error : new Error(stringifyError(error)));
	span.setStatus({
		code: otelApi.SpanStatusCode.ERROR,
		message: stringifyError(error)
	});
}
/**
* Run `fn` inside a new active span, ending the span when it settles and
* marking it failed if it throws. The error is always re-thrown: this records,
* it does not swallow.
*/
async function withSpan(name, fn, attributes) {
	return await getTracer().startActiveSpan(name, { attributes }, async (span) => {
		try {
			return await fn(span);
		} catch (e) {
			recordSpanError(span, e);
			throw e;
		} finally {
			span.end();
		}
	});
}
/** A random ID of `bytes` bytes, in the lowercase hex the W3C format uses. */
function randomHex(bytes) {
	return randomBytes(bytes).toString("hex");
}
/** Reject if `promise` has not settled within `timeoutMs`. */
async function withTimeout(promise, timeoutMs) {
	let timer;
	try {
		return await Promise.race([promise, new Promise((_resolve, reject) => {
			timer = setTimeout(() => reject(/* @__PURE__ */ new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
		})]);
	} finally {
		if (timer !== void 0) clearTimeout(timer);
	}
}
//#endregion
//#region src/ids-host.ts
/**
* @packageDocumentation
* Identifies and discovers backend servers for install.determinate.systems
*/
const DEFAULT_LOOKUP = "_detsys_ids._tcp.install.determinate.systems.";
const ALLOWED_SUFFIXES = [".install.determinate.systems", ".install.detsys.dev"];
const DEFAULT_IDS_HOST = "https://install.determinate.systems";
const LOOKUP = process.env["IDS_LOOKUP"] ?? DEFAULT_LOOKUP;
const DEFAULT_TIMEOUT = 1e4;
/**
* Host information for install.determinate.systems.
*/
var IdsHost = class {
	constructor(idsProjectName, diagnosticsSuffix, runtimeDiagnosticsUrl, timeout = DEFAULT_TIMEOUT) {
		this.idsProjectName = idsProjectName;
		this.diagnosticsSuffix = diagnosticsSuffix;
		this.runtimeDiagnosticsUrl = runtimeDiagnosticsUrl;
		this.client = void 0;
		this.timeout = timeout;
	}
	async getGot(recordFailoverCallback) {
		if (this.client === void 0) this.client = got.extend({
			timeout: { request: this.timeout },
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
					for (const [name, value] of Object.entries(traceContextHeaders())) options.headers[name] = value;
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
	/**
	* The diagnostics endpoint of the current backend.
	*
	* This library reports nothing there: its telemetry is OpenTelemetry. The
	* URL is for the programs an Action runs, which have diagnostics of their
	* own.
	*/
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
/**
* @packageDocumentation
* Helpers for getting values from an Action's configuration.
*/
var inputs_exports = /* @__PURE__ */ __exportAll({
	getArrayOfStrings: () => getArrayOfStrings,
	getArrayOfStringsOrNull: () => getArrayOfStringsOrNull,
	getBool: () => getBool,
	getBoolOrUndefined: () => getBoolOrUndefined,
	getMultilineStringOrNull: () => getMultilineStringOrNull,
	getNumberOrNull: () => getNumberOrNull,
	getNumberOrUndefined: () => getNumberOrUndefined,
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
* Get a Number input from the Action's configuration by name, or undefined if it is unset.
*/
const getNumberOrUndefined = (name) => {
	const value = getStringOrUndefined(name);
	if (value === void 0) return;
	return Number(value);
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
//#region src/log.ts
/**
* @packageDocumentation
* Logging that tees to both the GitHub Actions console and OpenTelemetry.
*
* These are drop-in replacements for the `@actions/core` logging functions.
* Every call still writes to the workflow log exactly as it did before -- the
* user-visible output is unchanged -- and additionally emits an OpenTelemetry
* LogRecord correlated to the currently active span.
*
* When telemetry is disabled the OpenTelemetry half is a no-op, so these
* behave identically to calling `@actions/core` directly.
*/
var log_exports = /* @__PURE__ */ __exportAll({
	debug: () => debug,
	error: () => error,
	group: () => group,
	info: () => info,
	notice: () => notice,
	setFailed: () => setFailed,
	warning: () => warning
});
function tee(level, message, attributes) {
	const text = typeof message === "string" ? message : stringifyError(message);
	emitLogRecord(level, text, attributes);
	return text;
}
/**
* Write a debug message. Only visible in the workflow log when the user has
* enabled step debug logging, but always exported to OpenTelemetry.
*/
function debug(message, attributes) {
	actionsCore.debug(tee("debug", message, attributes));
}
/** Write an informational message to the workflow log. */
function info(message, attributes) {
	actionsCore.info(tee("info", message, attributes));
}
/** Write a notice annotation to the workflow log. */
function notice(message, properties, attributes) {
	tee("notice", message, attributes);
	actionsCore.notice(message, properties);
}
/** Write a warning annotation to the workflow log. */
function warning(message, properties, attributes) {
	tee("warning", message, attributes);
	actionsCore.warning(message, properties);
}
/** Write an error annotation to the workflow log. */
function error(message, properties, attributes) {
	tee("error", message, attributes);
	actionsCore.error(message, properties);
}
/**
* Fail the workflow step, recording the reason as an OpenTelemetry error log.
*/
function setFailed(message, attributes) {
	tee("error", message, attributes);
	actionsCore.setFailed(message);
}
/**
* Run `fn` inside both a collapsible group in the workflow log and an active
* OpenTelemetry span of the same name.
*
* This is the replacement for a `startGroup`/`endGroup` pair: the group closes
* and the span ends even if `fn` throws, and a throwing `fn` marks the span
* failed before re-throwing.
*/
async function group(name, fn, attributes) {
	return await withSpan(name, async () => {
		actionsCore.startGroup(name);
		try {
			return await fn();
		} finally {
			actionsCore.endGroup();
		}
	}, attributes);
}
//#endregion
//#region src/platform.ts
/**
* @packageDocumentation
* Helpers for determining system attributes of the current runner.
*/
var platform_exports = /* @__PURE__ */ __exportAll({
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
	const mappedTo = (/* @__PURE__ */ new Map([
		["X64-macOS", "x86_64-darwin"],
		["ARM64-macOS", "aarch64-darwin"],
		["X64-Linux", "x86_64-linux"],
		["ARM64-Linux", "aarch64-linux"]
	])).get(archOs);
	if (mappedTo) return mappedTo;
	else {
		actionsCore.error(`ArchOs (${archOs}) doesn't map to a supported Nix platform.`);
		throw new Error(`Cannot convert ArchOs (${archOs}) to a supported Nix platform.`);
	}
}
//#endregion
//#region src/sourcedef.ts
/**
* Throw if hash-locking is requested against a source that is not pinned to a
* fixed version. `source-tag`, `source-revision`, and `source-url` are
* immutable (or caller-controlled); any other selector resolves to a moving
* target (`branch`, `pr`, or the `stable` fallback) where the pinned checksum
* would break the moment a new release is published.
*/
function assertChecksumSourceIsPinned(source) {
	if (source.url === void 0 && source.tag === void 0 && source.revision === void 0) throw new Error("Hash-locking via `source-checksums-url`/`source-checksums-sha256` requires a pinned source: set `source-tag`, `source-revision`, or `source-url`. Without one the action resolves to a moving target (e.g. `stable`) and the checksum will break the next time a release is published.");
}
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
/**
* @packageDocumentation
* Determinate Systems' TypeScript library for creating GitHub Actions logic.
*/
const EVENT_IDS_FAILOVER = "detsys.ids_failover";
const EVENT_PREFLIGHT_REQUIRE_NIX_DENIED = "detsys.preflight_require_nix_denied";
const EVENT_REQUEST_TIMEOUT = "detsys.request_timeout";
const EVENT_STORE_IDENTITY_FAILED = "detsys.store_identity_failed";
const ATTR_PROJECT = "detsys.project";
const ATTR_IDS_PROJECT = "detsys.ids_project";
const ATTR_EXECUTION_PHASE = "detsys.execution_phase";
const ATTR_CROSS_PHASE_ID = "detsys.cross_phase_id";
const ATTR_ANONYMOUS_ID = "detsys.anonymous_id";
const ATTR_CORRELATION_SOURCE = "detsys.correlation_source";
const ATTR_ARCH_OS = "detsys.arch_os";
const ATTR_NIX_SYSTEM = "detsys.nix_system";
const ATTR_FEATURE_PREFIX = "detsys.feature.";
const ATTR_GITHUB_EVENT_NAME = "detsys.github.event_name";
const ATTR_GITHUB_ACTION_REPOSITORY = "detsys.github.action_repository";
const ATTR_GITHUB_REPOSITORY_HASH = "detsys.github.repository_hash";
const ATTR_GITHUB_ORGANIZATION_HASH = "detsys.github.organization_hash";
const ATTR_GITHUB_WORKFLOW_HASH = "detsys.github.workflow_hash";
const ATTR_GITHUB_WORKFLOW_JOB_HASH = "detsys.github.workflow_job_hash";
const ATTR_GITHUB_WORKFLOW_RUN_HASH = "detsys.github.workflow_run_hash";
const ATTR_GITHUB_WORKFLOW_RUN_DIFFERENTIATOR_HASH = "detsys.github.workflow_run_differentiator_hash";
const ATTR_ARTIFACT_NAME = "detsys.artifact.name";
const ATTR_ARTIFACT_FETCH_SUFFIX = "detsys.artifact.fetch_suffix";
const ATTR_ARTIFACT_CACHE_HIT = "detsys.artifact.cache_hit";
const ATTR_SOURCE_URL = "detsys.source.url";
const ATTR_SOURCE_ETAG = "detsys.source.etag";
const ATTR_SOURCE_CHECKSUMS_SHA256 = "detsys.source.checksums_sha256";
const ATTR_NIX_LOCATION = "detsys.nix.location";
const ATTR_NIX_VERSION = "detsys.nix.version";
const ATTR_NIX_STORE_TRUST = "detsys.nix.store_trust";
const ATTR_NIX_STORE_VERSION = "detsys.nix.store_version";
const ATTR_NIX_STORE_CHECK_METHOD = "detsys.nix.store_check_method";
const ATTR_NIX_STORE_CHECK_ERROR = "detsys.nix.store_check_error";
const ATTR_ATTACHMENT_NAME = "detsys.attachment.name";
const ATTR_ATTACHMENT_PATH = "detsys.attachment.path";
const ATTR_BACKTRACE_ID = "detsys.backtrace.id";
const ATTR_BACKTRACE_SOURCE = "detsys.backtrace.source";
const ATTR_BACKTRACE_PROGRAM = "detsys.backtrace.program";
const STATE_KEY_EXECUTION_PHASE = "detsys_action_execution_phase";
const STATE_KEY_NIX_NOT_FOUND = "detsys_action_nix_not_found";
const STATE_NOT_FOUND = "not-found";
const STATE_KEY_CROSS_PHASE_ID = "detsys_cross_phase_id";
const STATE_BACKTRACE_START_TIMESTAMP = "detsys_backtrace_start_timestamp";
const STATE_KEY_TRACEPARENT = "detsys_otel_traceparent";
const STATE_KEY_JOB_TRACEPARENT = "detsys_otel_job_traceparent";
const STATE_KEY_JOB_SPAN_START = "detsys_otel_job_span_start";
const ENV_TRACEPARENT = "TRACEPARENT";
const SPAN_JOB = "github_actions_job";
const SPAN_CHECK_IN = "check_in";
const CHECK_IN_ENDPOINT_TIMEOUT_MS = 1e3;
const PROGRAM_NAME_CRASH_DENY_LIST = [
	"nix-expr-tests",
	"nix-store-tests",
	"nix-util-tests"
];
const determinateStateDir = "/var/lib/determinate";
const determinateIdentityFile = path.join(determinateStateDir, "identity.json");
const isRoot = typeof process.geteuid === "function" && process.geteuid() === 0;
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
		outStream: nodeFs.createWriteStream("/dev/null")
	});
	if (code !== 0) throw new Error(`sudo tee exit: ${code}`);
}
/** Writes correlation hashes to the Determinate state directory, escalating if necessary */
async function writeCorrelationHashes(hashes) {
	await ensureDeterminateStateDir();
	if (isRoot) await fs$1.writeFile(determinateIdentityFile, hashes, "utf-8");
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
		this.idsHost = new IdsHost(this.actionOptions.idsProjectName, actionOptions.diagnosticsSuffix, process.env["INPUT_DIAGNOSTIC-ENDPOINT"], getNumberOrUndefined("timeout-request"));
		this.telemetry = new Telemetry();
		this.exceptionAttachments = /* @__PURE__ */ new Map();
		this.nixStoreTrust = "unknown";
		this.strictMode = getBool("_internal-strict-mode");
		if (getBoolOrUndefined("_internal-obliterate-actions-id-token-request-variables") === true) {
			process.env["ACTIONS_ID_TOKEN_REQUEST_URL"] = void 0;
			process.env["ACTIONS_ID_TOKEN_REQUEST_TOKEN"] = void 0;
		}
		this.features = {};
		this.featureVariants = {};
		this.pendingAttributes = {};
		this.getCrossPhaseId();
		this.collectBacktraceSetup();
		this.identity = identify();
		this.archOs = getArchOs();
		this.nixSystem = getNixPlatform(this.archOs);
		this.systemDetails = getDetails().then((details) => ({
			name: details.name,
			version: details.version
		})).catch((e) => {
			actionsCore.debug(`Failure getting platform details: ${stringifyError$1(e)}`);
		});
		this.executionPhase = this.determineExecutionPhase();
		if (this.actionOptions.fetchStyle === "gh-env-style") this.architectureFetchSuffix = this.archOs;
		else if (this.actionOptions.fetchStyle === "nix-style") this.architectureFetchSuffix = this.nixSystem;
		else if (this.actionOptions.fetchStyle === "universal") this.architectureFetchSuffix = "universal";
		else throw new Error(`fetchStyle ${this.actionOptions.fetchStyle} is not a valid style`);
		this.sourceParameters = constructSourceParameters(this.actionOptions.legacySourcePrefix);
	}
	/**
	* Attach a file to the telemetry for this run, to be emitted if the Action
	* fails.
	*
	* The file at `location` doesn't need to exist when stapleFile is called.
	*
	* Each attachment becomes one OpenTelemetry log record, correlated to the
	* phase's span: the file's contents as the body if it can be read, the
	* reason it could not be read otherwise.
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
	/**
	* Describe this run with an attribute.
	*
	* The attribute lands on the phase's root span, not on whichever span
	* happens to be active, because it describes the run as a whole. Set it
	* whenever the value becomes known: attributes set before the span opens
	* are replayed onto it.
	*
	* Namespace your keys, as OpenTelemetry expects: `detsys.nix.version`, not
	* `nix_version`.
	*/
	setAttribute(key, value) {
		if (this.phaseSpan === void 0) this.pendingAttributes[key] = value;
		else this.phaseSpan.setAttribute(key, value);
	}
	/**
	* The diagnostics endpoint for the programs this Action runs, such as
	* `nix-installer` and `magic-nix-cache`.
	*
	* This library reports nothing there. Its own telemetry is OpenTelemetry;
	* see {@link getTelemetryEnvironment} for putting a child process's
	* telemetry in this run's trace.
	*/
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
	/**
	* Record that something happened, as a span event.
	*
	* The event lands on whichever span is active, so that it sits on the
	* operation that produced it, and on the phase's root span when there is no
	* nested span in progress.
	*
	* Namespace your attribute keys, as OpenTelemetry expects.
	*/
	addEvent(name, attributes) {
		(otelApi.trace.getActiveSpan() ?? this.phaseSpan)?.addEvent(name, attributes);
	}
	/**
	* Unpacks the closure returned by `fetchArtifact()`, imports the
	* contents into the Nix store, and returns the path of the executable at
	* `/nix/store/STORE_PATH/bin/${bin}`.
	*/
	async unpackClosure(bin) {
		const artifact = await this.fetchArtifact();
		const { stdout } = await promisify(exec)(`cat "${artifact}" | xz -d | nix-store --import`);
		return `${stdout.split(os.EOL).at(-2)}/bin/${bin}`;
	}
	/**
	* Fetches the executable at the URL determined by the `source-*` inputs and
	* other facts, `chmod`s it, and returns the path to the executable on disk.
	*/
	async fetchExecutable() {
		const binaryPath = await this.fetchArtifact();
		await chmod(binaryPath, nodeFs.constants.S_IXUSR | nodeFs.constants.S_IXGRP);
		return binaryPath;
	}
	get isMain() {
		return this.executionPhase === "main";
	}
	get isPost() {
		return this.executionPhase === "post";
	}
	async executeAsync() {
		const phaseStartTime = /* @__PURE__ */ new Date();
		try {
			this.announceJobTrace(phaseStartTime);
			this.announcePhaseSpan();
			await this.checkIn();
			await this.startTelemetry();
			this.startPhaseSpan(phaseStartTime);
			this.startCheckInSpan();
			await this.withPhaseSpanActive(async () => {
				const correlationHashes = JSON.stringify(this.getCorrelationHashes());
				process.env.DETSYS_CORRELATION = correlationHashes;
				try {
					await writeCorrelationHashes(correlationHashes);
				} catch (error) {
					this.addEvent(EVENT_STORE_IDENTITY_FAILED, { [semconv.ATTR_EXCEPTION_MESSAGE]: stringifyError$1(error) });
				}
				if (!await this.preflightRequireNix()) {
					this.addEvent(EVENT_PREFLIGHT_REQUIRE_NIX_DENIED);
					return;
				} else {
					await this.preflightNixStoreInfo();
					await this.preflightNixVersion();
					this.setAttribute(ATTR_NIX_STORE_TRUST, this.nixStoreTrust);
				}
				if (this.isMain) {
					await this.main();
					await this.preflightNixVersion();
				} else if (this.isPost) await this.post();
			});
		} catch (e) {
			const reportable = stringifyError$1(e);
			if (this.phaseSpan !== void 0) recordSpanError(this.phaseSpan, e);
			if (this.isPost) warning(reportable);
			else setFailed(reportable);
			await this.withPhaseSpanActive(async () => {
				await this.emitAttachments();
			});
		} finally {
			await this.withPhaseSpanActive(async () => {
				if (this.isPost) await this.collectBacktraces();
			});
			await this.complete();
		}
	}
	/**
	* Run `fn` with the phase's root span as the active span, so anything it
	* starts is parented into this phase's trace.
	*/
	async withPhaseSpanActive(fn) {
		const span = this.phaseSpan;
		if (span === void 0) return await fn();
		return await otelApi.context.with(otelApi.trace.setSpan(otelApi.context.active(), span), fn);
	}
	/**
	* Start the OpenTelemetry export.
	*
	* All runs export their data.
	* To stop the export, set `OTEL_SDK_DISABLED` to `true`, or set
	* `OTEL_EXPORTER_OTLP_ENDPOINT` to an empty value.
	* The SDK then does not start.
	* The OpenTelemetry API stays in its no-op state.
	* Each span and log record then does nothing.
	* Thus the call sites do not test if the export is on.
	*
	* This function runs after the check-in.
	* The check-in supplies the feature flags for the resource attributes.
	*/
	async startTelemetry() {
		this.telemetry.start({
			serviceName: `${this.actionOptions.name}-action`,
			serviceVersion: process.env["GITHUB_ACTION_REF"],
			resourceAttributes: await this.telemetryResourceAttributes()
		});
	}
	/**
	* Put every Action of this workflow job in one trace.
	*
	* A job runs each Action as a process of its own.
	* Thus the Actions can only agree on a trace through the job's environment.
	* The first Action to run makes the identity of the job's span and exports it
	* as `$TRACEPARENT`.
	* Each later step finds it there: the other Actions, and the programs the
	* workflow runs, such as Nix.
	*
	* The span itself starts and ends in the post phase of the Action that
	* announced it.
	* GitHub Actions runs the post phases in the reverse of the order of the main
	* phases, thus that phase is the last one of the job.
	* The span then covers the whole job.
	* See {@link endJobSpan}.
	*
	* A `$TRACEPARENT` that is already set belongs to an earlier Action, or to the
	* system that started the workflow.
	* Do not change it, and join that trace.
	*/
	announceJobTrace(startTime) {
		if (!this.isMain || !exportEnabled()) return;
		if (process.env[ENV_TRACEPARENT]) return;
		const traceparent = newTraceparent();
		actionsCore.exportVariable(ENV_TRACEPARENT, traceparent);
		actionsCore.saveState(STATE_KEY_JOB_TRACEPARENT, traceparent);
		actionsCore.saveState(STATE_KEY_JOB_SPAN_START, `${startTime.getTime()}`);
	}
	/**
	* End the job's span, if this Action is the one that announced it.
	*
	* The span also starts here.
	* A span belongs to the process that ends it, and the process that made the
	* announcement stopped long ago.
	* See {@link announceJobTrace}.
	*/
	endJobSpan() {
		if (!this.isPost) return;
		const traceparent = actionsCore.getState(STATE_KEY_JOB_TRACEPARENT);
		if (traceparent === "") return;
		const startTime = parseInt(actionsCore.getState(STATE_KEY_JOB_SPAN_START), 10);
		this.telemetry.startAnnouncedSpan(SPAN_JOB, traceparent, new Date(Number.isFinite(startTime) ? startTime : Date.now()))?.end();
	}
	/**
	* Make the identity of a span that starts later, and point each request made
	* until then at it.
	*
	* The variable changes in this process only.
	* The later steps of the job keep the identity of the job's span.
	*/
	announceSpan(parent) {
		if (!exportEnabled()) return;
		const traceparent = newTraceparent(parent);
		process.env[ENV_TRACEPARENT] = traceparent;
		return traceparent;
	}
	/**
	* Announce the identity of this phase's span.
	*
	* The span cannot start until the SDK does, and the SDK cannot start until
	* the check-in supplies the feature flags.
	* Thus this Action makes requests before it has a span of its own.
	* The announcement gives those requests the identity that the span starts
	* with later, so that the work the servers do for them is part of this
	* Action, and not of the workflow job.
	*
	* `main` and `post` are separate processes.
	* Thus the main phase saves its identity in the Action's state, and the post
	* phase makes its span a child of it.
	* A `$TRACEPARENT` in the environment is the span of the workflow job, or of
	* the system that started the workflow.
	*/
	announcePhaseSpan() {
		this.phaseParentTraceparent = actionsCore.getState(STATE_KEY_TRACEPARENT) || process.env[ENV_TRACEPARENT] || void 0;
		this.phaseTraceparent = this.announceSpan(this.phaseParentTraceparent);
	}
	/**
	* Start the root span of this execution phase, with the identity that {@link
	* announcePhaseSpan} announced.
	*
	* The span starts at the moment the phase did, and thus covers the check-in
	* and the start of the SDK, which both come before it.
	*/
	startPhaseSpan(startTime) {
		if (this.phaseTraceparent === void 0) return;
		const span = this.telemetry.startAnnouncedSpan(`${this.actionOptions.name}:${this.executionPhase}`, this.phaseTraceparent, startTime, contextFromTraceparent(this.phaseParentTraceparent));
		if (span === void 0) return;
		span.setAttributes(this.pendingAttributes);
		this.pendingAttributes = {};
		if (this.isMain) {
			const traceparent = traceparentOf(span);
			if (traceparent !== void 0) actionsCore.saveState(STATE_KEY_TRACEPARENT, traceparent);
		}
		this.phaseSpan = span;
	}
	/**
	* Start and end the span for the check-in, which ran before the SDK could
	* record it.
	*/
	startCheckInSpan() {
		const timing = this.checkInTiming;
		if (timing === void 0 || this.phaseSpan === void 0) return;
		this.telemetry.startAnnouncedSpan(SPAN_CHECK_IN, timing.traceparent, timing.startTime, otelApi.trace.setSpan(otelApi.context.active(), this.phaseSpan))?.end(timing.endTime);
	}
	/**
	* The stable, run-scoped attributes attached to every span and log record.
	*
	* The correlation data here is hashed and does not identify a repository,
	* an organization, or a person.
	*/
	async telemetryResourceAttributes() {
		const details = await this.systemDetails;
		return {
			[semconvIncubating.ATTR_OS_TYPE]: osType(),
			[semconvIncubating.ATTR_HOST_ARCH]: hostArch(),
			...details?.name === void 0 || details.name === "unknown" ? {} : { [semconvIncubating.ATTR_OS_NAME]: details.name },
			...details?.version === void 0 || details.version === "unknown" ? {} : { [semconvIncubating.ATTR_OS_VERSION]: details.version },
			[ATTR_PROJECT]: this.actionOptions.name,
			[ATTR_IDS_PROJECT]: this.actionOptions.idsProjectName,
			[ATTR_EXECUTION_PHASE]: this.executionPhase,
			[ATTR_CROSS_PHASE_ID]: this.getCrossPhaseId(),
			[ATTR_ANONYMOUS_ID]: this.identity.$anon_distinct_id,
			[ATTR_CORRELATION_SOURCE]: this.identity.correlation_source,
			[ATTR_ARCH_OS]: this.archOs,
			[ATTR_NIX_SYSTEM]: this.nixSystem,
			[ATTR_GITHUB_EVENT_NAME]: process.env["GITHUB_EVENT_NAME"],
			[ATTR_GITHUB_ACTION_REPOSITORY]: process.env["GITHUB_ACTION_REPOSITORY"],
			[ATTR_GITHUB_REPOSITORY_HASH]: this.identity.github_repository_hash,
			[ATTR_GITHUB_ORGANIZATION_HASH]: this.identity.$groups["github_organization"],
			[ATTR_GITHUB_WORKFLOW_HASH]: this.identity.github_workflow_hash,
			[ATTR_GITHUB_WORKFLOW_JOB_HASH]: this.identity.github_workflow_job_hash,
			[ATTR_GITHUB_WORKFLOW_RUN_HASH]: this.identity.github_workflow_run_hash,
			[ATTR_GITHUB_WORKFLOW_RUN_DIFFERENTIATOR_HASH]: this.identity.github_workflow_run_differentiator_hash,
			...Object.fromEntries(Object.entries(this.featureVariants).map(([name, variant]) => [`${ATTR_FEATURE_PREFIX}${name}`, variant]))
		};
	}
	/**
	* The W3C `traceparent` identifying the span currently in progress.
	*
	* Hand this to a child process -- as `$TRACEPARENT` -- so that its own
	* OpenTelemetry data joins this Action's trace. Returns undefined when
	* OpenTelemetry export is disabled for this run.
	*/
	getTraceparent() {
		return traceparentOf(otelApi.trace.getActiveSpan() ?? this.phaseSpan);
	}
	/**
	* The environment variables that let a child process add data to this
	* Action's trace: the current `$TRACEPARENT` and the OTLP export settings.
	*
	* Add these variables to the environment of each child process to trace.
	* A child that inherits this process's environment already has the OTLP
	* settings; only `$TRACEPARENT` changes as the run proceeds.
	*
	* The result is empty if the OpenTelemetry export is off.
	* Thus it is always safe to add them.
	*/
	async getTelemetryEnvironment() {
		if (!this.telemetry.enabled) return {};
		const environment = otlpExportEnvironment();
		const traceparent = this.getTraceparent();
		if (traceparent !== void 0) environment["TRACEPARENT"] = traceparent;
		return environment;
	}
	async getClient() {
		return await this.idsHost.getGot((incitingError, prevUrl, nextUrl) => {
			this.recordPlausibleTimeout(incitingError);
			this.addEvent(EVENT_IDS_FAILOVER, {
				"detsys.ids.previous_url": prevUrl.toString(),
				"detsys.ids.next_url": nextUrl.toString()
			});
		});
	}
	async checkIn() {
		const traceparent = this.announceSpan(this.phaseTraceparent);
		const startTime = /* @__PURE__ */ new Date();
		try {
			await this.checkInAndReport();
		} finally {
			if (traceparent !== void 0) this.checkInTiming = {
				traceparent,
				startTime,
				endTime: /* @__PURE__ */ new Date()
			};
			if (this.phaseTraceparent !== void 0) process.env[ENV_TRACEPARENT] = this.phaseTraceparent;
		}
	}
	/**
	* Check in, and tell the user about the incidents and the maintenance the
	* check-in reports.
	*/
	async checkInAndReport() {
		const checkin = await this.requestCheckIn();
		if (checkin === void 0) return;
		this.features = checkin.options;
		for (const [key, feature] of Object.entries(this.features)) this.featureVariants[key] = feature.variant;
		const impactSymbol = /* @__PURE__ */ new Map([
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
	/**
	* The variant of a feature flag this run resolved, if the check-in returned
	* one.
	*
	* Every resolved variant is already a resource attribute, under
	* `detsys.feature.`, so the telemetry can be sliced by the flags that
	* produced it.
	*/
	getFeature(name) {
		if (!this.features.hasOwnProperty(name)) return;
		return this.features[name];
	}
	/**
	* The person properties the check-in evaluates feature flags against.
	*
	* These names are the flag-targeting contract with the feature flag
	* service, which is why they keep their `$`-prefixed spelling. They are not
	* telemetry: nothing here is reported anywhere. The telemetry for this run
	* is OpenTelemetry, and it names the same values the way OpenTelemetry
	* does.
	*/
	async checkInPersonProperties() {
		const properties = {
			ci: "github",
			$lib: "idslib",
			$lib_version: "1.0",
			$app_name: `${this.actionOptions.name}/action`,
			project: this.actionOptions.name,
			ids_project: this.actionOptions.idsProjectName,
			arch_os: this.archOs,
			nix_system: this.nixSystem,
			execution_phase: this.executionPhase
		};
		for (const [target, variable] of [
			["github_action_ref", "GITHUB_ACTION_REF"],
			["github_action_repository", "GITHUB_ACTION_REPOSITORY"],
			["github_event_name", "GITHUB_EVENT_NAME"],
			["$os", "RUNNER_OS"],
			["arch", "RUNNER_ARCH"]
		]) {
			const value = process.env[variable];
			if (value) properties[target] = value;
		}
		const details = await this.systemDetails;
		if (details !== void 0) {
			if (details.name !== "unknown") properties.$os = details.name;
			if (details.version !== "unknown") properties.$os_version = details.version;
		}
		return {
			...properties,
			...this.identity
		};
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
					person_properties: await this.checkInPersonProperties()
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
			const attributes = {
				[semconv.ATTR_URL_FULL]: e.request.requestUrl?.toString(),
				[semconv.ATTR_HTTP_REQUEST_RESEND_COUNT]: e.request.retryCount
			};
			for (const [key, value] of Object.entries(e.timings.phases)) if (Number.isFinite(value)) attributes[`detsys.http.timing.${key}`] = value;
			this.addEvent(EVENT_REQUEST_TIMEOUT, attributes);
		}
	}
	/**
	* Fetch an artifact, such as a tarball, from the location determined by the
	* `source-*` inputs. If `source-binary` is specified, this will return a path
	* to a binary on disk; otherwise, the artifact will be downloaded from the
	* URL determined by the other `source-*` inputs (`source-url`, `source-pr`,
	* etc.).
	*
	* When `source-checksums-url` and `source-checksums-sha256` are both set,
	* the downloaded artifact is verified against the per-arch hash in the
	* checksums file, which is itself verified against the pinned
	* `source-checksums-sha256`. Both inputs must be set together.
	*/
	async fetchArtifact() {
		const sourceBinary = getStringOrNull("source-binary");
		if (sourceBinary !== null && sourceBinary !== "") {
			debug(`Using the provided source binary at ${sourceBinary}`);
			return sourceBinary;
		}
		return await withSpan("fetch_artifact", async (span) => {
			const expectedArtifactHash = await this.resolveExpectedArtifactHash();
			actionsCore.startGroup(`Downloading ${this.actionOptions.name} for ${this.architectureFetchSuffix}`);
			try {
				info(`Fetching from ${await this.getSourceUrl()}`);
				const correlatedUrl = await this.getSourceUrl();
				correlatedUrl.searchParams.set("ci", "github");
				correlatedUrl.searchParams.set("correlation", JSON.stringify(this.identity));
				const versionCheckup = await (await this.getClient()).head(correlatedUrl);
				if (versionCheckup.headers.etag) {
					const v = versionCheckup.headers.etag;
					this.setAttribute(ATTR_SOURCE_ETAG, v);
					debug(`Checking the tool cache for ${await this.getSourceUrl()} at ${v}`);
					const cached = await this.getCachedVersion(v, expectedArtifactHash);
					if (cached) {
						span.setAttribute(ATTR_ARTIFACT_CACHE_HIT, true);
						debug(`Tool cache hit.`);
						await this.verifyArtifactHash(cached, expectedArtifactHash);
						return cached;
					}
				}
				span.setAttribute(ATTR_ARTIFACT_CACHE_HIT, false);
				debug(`No match from the cache, re-fetching from the redirect: ${versionCheckup.url}`);
				const destFile = this.getTemporaryName();
				const fetchStream = await this.downloadFile(new URL(versionCheckup.url), destFile);
				await this.verifyArtifactHash(destFile, expectedArtifactHash);
				if (fetchStream.response?.headers.etag) {
					const v = fetchStream.response.headers.etag;
					try {
						await this.saveCachedVersion(v, destFile, expectedArtifactHash);
					} catch (e) {
						debug(`Error caching the artifact: ${stringifyError$1(e)}`);
					}
				}
				return destFile;
			} catch (e) {
				this.recordPlausibleTimeout(e);
				throw e;
			} finally {
				actionsCore.endGroup();
			}
		}, {
			[ATTR_ARTIFACT_NAME]: this.actionOptions.name,
			[ATTR_ARTIFACT_FETCH_SUFFIX]: this.architectureFetchSuffix
		});
	}
	/**
	* Read the `source-checksums-url` and `source-checksums-sha256` inputs and,
	* if both are set, fetch the checksums file, verify its hash matches the
	* pin, parse it, and return the expected hash for the artifact matching
	* this runner's `${name}-${architectureFetchSuffix}`. Returns `null` when
	* verification is opted out (both inputs unset).
	*/
	async resolveExpectedArtifactHash() {
		const checksumsUrl = getStringOrNull("source-checksums-url");
		const checksumsSha256 = getStringOrNull("source-checksums-sha256");
		if (checksumsUrl === null && checksumsSha256 === null) return null;
		if (checksumsUrl === null || checksumsSha256 === null) throw new Error("`source-checksums-url` and `source-checksums-sha256` must be set together");
		assertChecksumSourceIsPinned(this.sourceParameters);
		const expectedFileHash = checksumsSha256.toLowerCase();
		this.setAttribute(ATTR_SOURCE_CHECKSUMS_SHA256, expectedFileHash);
		const parsedUrl = new URL(checksumsUrl);
		const safeUrl = parsedUrl.origin + parsedUrl.pathname;
		actionsCore.info(`Fetching checksums file from ${safeUrl}`);
		const body = (await (await this.getClient()).get(checksumsUrl)).body;
		const actualFileHash = sha256OfBuffer(body);
		if (actualFileHash !== expectedFileHash) throw new Error(`Checksums file hash mismatch at ${safeUrl}: expected ${expectedFileHash}, got ${actualFileHash}`);
		const wanted = `${this.actionOptions.name}-${this.architectureFetchSuffix}`;
		const artifactHash = parseChecksumsFile(body).get(wanted);
		if (artifactHash === void 0) throw new Error(`No entry for ${wanted} in checksums file at ${safeUrl}`);
		return artifactHash;
	}
	/**
	* Verify a downloaded artifact's SHA-256 matches the expected hash. No-op
	* when `expected` is `null` (verification disabled).
	*/
	async verifyArtifactHash(filePath, expected) {
		if (expected === null) return;
		const actual = await sha256OfFile(filePath);
		if (actual !== expected) throw new Error(`Artifact hash mismatch for ${this.architectureFetchSuffix}: expected ${expected}, got ${actual}`);
	}
	/**
	* A helper function for failing on error only if strict mode is enabled.
	* This is intended only for CI environments testing Actions themselves.
	*/
	failOnError(msg) {
		if (this.strictMode) actionsCore.setFailed(`strict mode failure: ${msg}`);
	}
	async downloadFile(url, destination) {
		return await withSpan("download_file", async () => this.download(url, destination));
	}
	async download(url, destination) {
		const client = await this.getClient();
		return new Promise((resolve, reject) => {
			let writeStream;
			let failed = false;
			const retry = (stream) => {
				if (writeStream) writeStream.destroy();
				writeStream = nodeFs.createWriteStream(destination, {
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
		this.phaseSpan?.end();
		this.phaseSpan = void 0;
		this.endJobSpan();
		await this.telemetry.shutdown();
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
			this.setAttribute(ATTR_SOURCE_URL, p.url);
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
		this.setAttribute(ATTR_SOURCE_URL, fetchUrl.toString());
		return fetchUrl;
	}
	cacheKey(version, expectedHash) {
		const cleanedVersion = version.replace(/[^a-zA-Z0-9-+.]/g, "");
		const hashSuffix = expectedHash ? `-h${expectedHash}` : "";
		return `determinatesystem-${this.actionOptions.name}-${this.architectureFetchSuffix}-${cleanedVersion}${hashSuffix}`;
	}
	async getCachedVersion(version, expectedHash) {
		return await withSpan("artifact_cache_restore", async (span) => {
			const startCwd = process.cwd();
			try {
				const tempDir = this.getTemporaryName();
				await mkdir(tempDir);
				process.chdir(tempDir);
				process.env.GITHUB_WORKSPACE_BACKUP = process.env.GITHUB_WORKSPACE;
				delete process.env.GITHUB_WORKSPACE;
				if (await actionsCache.restoreCache([this.actionOptions.name], this.cacheKey(version, expectedHash), [], void 0, true)) {
					span.setAttribute(ATTR_ARTIFACT_CACHE_HIT, true);
					return `${tempDir}/${this.actionOptions.name}`;
				}
				span.setAttribute(ATTR_ARTIFACT_CACHE_HIT, false);
				return;
			} finally {
				process.env.GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE_BACKUP;
				delete process.env.GITHUB_WORKSPACE_BACKUP;
				process.chdir(startCwd);
			}
		});
	}
	async saveCachedVersion(version, toolPath, expectedHash) {
		return await withSpan("artifact_cache_persist", async () => {
			const startCwd = process.cwd();
			try {
				const tempDir = this.getTemporaryName();
				await mkdir(tempDir);
				process.chdir(tempDir);
				await copyFile(toolPath, `${tempDir}/${this.actionOptions.name}`);
				process.env.GITHUB_WORKSPACE_BACKUP = process.env.GITHUB_WORKSPACE;
				delete process.env.GITHUB_WORKSPACE;
				await actionsCache.saveCache([this.actionOptions.name], this.cacheKey(version, expectedHash), void 0, true);
			} finally {
				process.env.GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE_BACKUP;
				delete process.env.GITHUB_WORKSPACE_BACKUP;
				process.chdir(startCwd);
			}
		});
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
			const backtraces = await withSpan("collect_backtraces", async () => collectBacktraces(this.actionOptions.binaryNamePrefixes, this.actionOptions.binaryNamesDenyList, parseInt(actionsCore.getState(STATE_BACKTRACE_START_TIMESTAMP))));
			debug(`Backtraces identified: ${backtraces.length}`);
			for (const backtrace of backtraces) {
				const attributes = {
					[ATTR_BACKTRACE_ID]: backtrace.id,
					[ATTR_BACKTRACE_SOURCE]: backtrace.source,
					[ATTR_BACKTRACE_PROGRAM]: backtrace.program
				};
				if (backtrace.report !== void 0) emitLogRecord("error", backtrace.report, attributes);
				else emitLogRecord("error", `Crash report unavailable`, {
					...attributes,
					[semconv.ATTR_EXCEPTION_MESSAGE]: backtrace.error
				});
			}
		} catch (innerError) {
			actionsCore.debug(`Error collecting backtraces: ${stringifyError$1(innerError)}`);
		}
	}
	/**
	* Emit the files `stapleFile` collected, as log records correlated to this
	* phase's span. The Action has already failed by the time this runs.
	*/
	async emitAttachments() {
		for (const [name, location] of this.exceptionAttachments) {
			const attributes = {
				[ATTR_ATTACHMENT_NAME]: name,
				[ATTR_ATTACHMENT_PATH]: location.toString()
			};
			try {
				emitLogRecord("error", await readFile(location, "utf-8"), attributes);
			} catch (innerError) {
				emitLogRecord("error", `Attachment unavailable`, {
					...attributes,
					[semconv.ATTR_EXCEPTION_MESSAGE]: stringifyError$1(innerError)
				});
			}
		}
	}
	async preflightRequireNix() {
		return await withSpan("preflight_require_nix", async () => {
			let nixLocation;
			const pathParts = (process.env["PATH"] || "").split(":");
			for (const location of pathParts) {
				const candidateNix = path.join(location, "nix");
				try {
					await fs$1.access(candidateNix, fs$1.constants.X_OK);
					debug(`Found Nix at ${candidateNix}`);
					nixLocation = candidateNix;
					break;
				} catch {
					actionsCore.debug(`Nix not at ${candidateNix}`);
				}
			}
			this.setAttribute(ATTR_NIX_LOCATION, nixLocation || "");
			if (this.actionOptions.requireNix === "ignore") return true;
			if (actionsCore.getState(STATE_KEY_NIX_NOT_FOUND) === STATE_NOT_FOUND) return false;
			if (nixLocation !== void 0) return true;
			actionsCore.saveState(STATE_KEY_NIX_NOT_FOUND, STATE_NOT_FOUND);
			switch (this.actionOptions.requireNix) {
				case "fail":
					setFailed(["This action can only be used when Nix is installed.", "Add `- uses: DeterminateSystems/determinate-nix-action@v3` earlier in your workflow."].join(" "));
					break;
				case "warn": warning(["This action is in no-op mode because Nix is not installed.", "Add `- uses: DeterminateSystems/determinate-nix-action@v3` earlier in your workflow."].join(" "));
			}
			return false;
		});
	}
	async preflightNixStoreInfo() {
		return await withSpan("preflight_nix_store_info", async (span) => {
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
				this.setAttribute(ATTR_NIX_STORE_CHECK_METHOD, "info");
			} catch {
				try {
					output = "";
					await exec$1.exec("nix", [
						"store",
						"ping",
						"--json"
					], options);
					this.setAttribute(ATTR_NIX_STORE_CHECK_METHOD, "ping");
				} catch {
					this.setAttribute(ATTR_NIX_STORE_CHECK_METHOD, "none");
					return;
				}
			}
			try {
				const parsed = JSON.parse(output);
				if (parsed.trusted === true || parsed.trusted === 1) this.nixStoreTrust = "trusted";
				else if (parsed.trusted === false || parsed.trusted === 0) this.nixStoreTrust = "untrusted";
				else if (parsed.trusted !== void 0) this.setAttribute(ATTR_NIX_STORE_CHECK_ERROR, `Mysterious trusted value: ${JSON.stringify(parsed.trusted)}`);
				this.setAttribute(ATTR_NIX_STORE_VERSION, JSON.stringify(parsed.version));
			} catch (e) {
				this.setAttribute(ATTR_NIX_STORE_CHECK_ERROR, stringifyError$1(e));
			}
			span.setAttribute(ATTR_NIX_STORE_TRUST, this.nixStoreTrust);
		});
	}
	async preflightNixVersion() {
		return await withSpan("preflight_nix_version", async (span) => {
			let output = "unknown";
			try {
				({stdout: output} = await exec$1.getExecOutput("nix", ["--version"], { silent: true }));
				output = output.trim() || "unknown";
			} catch {}
			this.setAttribute(ATTR_NIX_VERSION, output);
			span.setAttribute(ATTR_NIX_VERSION, output);
		});
	}
};
function stringifyError$1(error) {
	return error instanceof Error || typeof error == "string" ? error.toString() : JSON.stringify(error);
}
/**
* The runner's operating system, as `os.type` spells it.
*/
function osType() {
	switch (platform) {
		case "win32": return semconvIncubating.OS_TYPE_VALUE_WINDOWS;
		case "darwin": return semconvIncubating.OS_TYPE_VALUE_DARWIN;
		case "linux": return semconvIncubating.OS_TYPE_VALUE_LINUX;
		default: return platform;
	}
}
/**
* The runner's architecture, as `host.arch` spells it.
*/
function hostArch() {
	switch (arch) {
		case "x64": return semconvIncubating.HOST_ARCH_VALUE_AMD64;
		case "arm64": return semconvIncubating.HOST_ARCH_VALUE_ARM64;
		case "ia32": return semconvIncubating.HOST_ARCH_VALUE_X86;
		case "arm": return semconvIncubating.HOST_ARCH_VALUE_ARM32;
		default: return arch;
	}
}
function makeOptionsConfident(actionOptions) {
	const idsProjectName = actionOptions.idsProjectName ?? actionOptions.name;
	const finalOpts = {
		name: actionOptions.name,
		idsProjectName,
		fetchStyle: actionOptions.fetchStyle,
		legacySourcePrefix: actionOptions.legacySourcePrefix,
		requireNix: actionOptions.requireNix,
		binaryNamePrefixes: actionOptions.binaryNamePrefixes ?? [
			"nix",
			"determinate-nixd",
			actionOptions.name
		],
		binaryNamesDenyList: actionOptions.binaryNamesDenyList ?? PROGRAM_NAME_CRASH_DENY_LIST
	};
	actionsCore.debug("idslib options:");
	actionsCore.debug(JSON.stringify(finalOpts, void 0, 2));
	return finalOpts;
}
//#endregion
export { DetSysAction, IdsHost, SCOPE_NAME, contextFromTraceparent, getLogger, getTracer, inputs_exports as inputs, log_exports as log, platform_exports as platform, recordSpanError, stringifyError, traceContextHeaders, traceparentOf, withSpan };

//# sourceMappingURL=index.mjs.map
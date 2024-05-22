/**
 * @packageDocumentation
 * Determinate Systems' TypeScript library for creating GitHub Actions logic.
 */
import { version as pkgVersion } from "../package.json";
import * as ghActionsCorePlatform from "./actions-core-platform.js";
import * as correlation from "./correlation.js";
import { getBool, getStringOrNull } from "./inputs.js";
import * as platform from "./platform.js";
import { SourceDef, constructSourceParameters } from "./sourcedef.js";
import * as actionsCache from "@actions/cache";
import * as actionsCore from "@actions/core";
import * as actionsExec from "@actions/exec";
import got, { Got } from "got";
import { exec } from "node:child_process";
import { UUID, randomUUID } from "node:crypto";
import { PathLike, createWriteStream, readFileSync } from "node:fs";
import fs, { chmod, copyFile, mkdir } from "node:fs/promises";
import * as os from "node:os";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { gzip } from "node:zlib";

const DEFAULT_IDS_HOST = "https://install.determinate.systems";
const IDS_HOST = process.env["IDS_HOST"] ?? DEFAULT_IDS_HOST;

const EVENT_EXCEPTION = "exception";
const EVENT_ARTIFACT_CACHE_HIT = "artifact_cache_hit";
const EVENT_ARTIFACT_CACHE_MISS = "artifact_cache_miss";
const EVENT_ARTIFACT_CACHE_PERSIST = "artifact_cache_persist";
const EVENT_PREFLIGHT_REQUIRE_NIX_DENIED = "preflight-require-nix-denied";

const FACT_ENDED_WITH_EXCEPTION = "ended_with_exception";
const FACT_FINAL_EXCEPTION = "final_exception";
const FACT_OS = "$os";
const FACT_OS_VERSION = "$os_version";
const FACT_SOURCE_URL = "source_url";
const FACT_SOURCE_URL_ETAG = "source_url_etag";

const FACT_NIX_LOCATION = "nix_location";
const FACT_NIX_STORE_TRUST = "nix_store_trusted";
const FACT_NIX_STORE_VERSION = "nix_store_version";
const FACT_NIX_STORE_CHECK_METHOD = "nix_store_check_method";
const FACT_NIX_STORE_CHECK_ERROR = "nix_store_check_error";

const STATE_KEY_EXECUTION_PHASE = "detsys_action_execution_phase";
const STATE_KEY_NIX_NOT_FOUND = "detsys_action_nix_not_found";
const STATE_NOT_FOUND = "not-found";

/**
 * An enum for describing different "fetch suffixes" for i.d.s.
 *
 * - `nix-style` means that system names like `x86_64-linux` and `aarch64-darwin` are used
 * - `gh-env-style` means that names like `X64-Linux` and `ARM64-macOS` are used
 * - `universal` means that the suffix is the static `universal` (for non-system-specific things)
 */
export type FetchSuffixStyle = "nix-style" | "gh-env-style" | "universal";

/**
 * GitHub Actions has two possible execution phases: `main` and `post`.
 */
export type ExecutionPhase = "main" | "post";

/**
 * How to handle whether Nix is currently installed on the runner.
 *
 * - `fail` means that the workflow fails if Nix isn't installed
 * - `warn` means that a warning is logged if Nix isn't installed
 * - `ignore` means that Nix will not be checked
 */
export type NixRequirementHandling = "fail" | "warn" | "ignore";

/**
 * Whether the Nix store on the runner is trusted.
 *
 * - `trusted` means yes
 * - `untrusted` means no
 * - `unknown` means that the status couldn't be determined
 *
 * This is determined via the output of `nix store info --json`.
 */
export type NixStoreTrust = "trusted" | "untrusted" | "unknown";

export type ActionOptions = {
  // Name of the project generally, and the name of the binary on disk.
  name: string;

  // Defaults to `name`, Corresponds to the ProjectHost entry on i.d.s.
  idsProjectName?: string;

  // Defaults to `action:`
  eventPrefix?: string;

  // The "architecture" URL component expected by I.D.S. for the ProjectHost.
  fetchStyle: FetchSuffixStyle;

  // IdsToolbox assumes the GitHub Action exposes source overrides, like branch/pr/etc. to be named `source-*`.
  // This prefix adds a fallback name, prefixed by `${legacySourcePrefix}-`.
  // Users who configure legacySourcePrefix will get warnings asking them to change to `source-*`.
  legacySourcePrefix?: string;

  // Check if Nix is installed before running this action.
  // If Nix isn't installed, this action will not fail, and will instead do nothing.
  // The action will emit a user-visible warning instructing them to install Nix.
  requireNix: NixRequirementHandling;

  // The URL to send diagnostics events to.
  // Specifically:
  //  * `undefined` -> Attempt to read the `diagnostic-enpdoint` action input, and calculate the default diagnostics URL for IDS from there.
  //  * `null` -> Disable sending diagnostics altogether.
  //  * URL(...) -> Send diagnostics to this other URL instead
  diagnosticsUrl?: URL | null;
};

// A confident version of Options, where defaults have been resolved into final values
type ConfidentActionOptions = {
  name: string;
  idsProjectName: string;
  eventPrefix: string;
  fetchStyle: FetchSuffixStyle;
  legacySourcePrefix?: string;
  requireNix: NixRequirementHandling;
  diagnosticsUrl?: URL;
};

type DiagnosticEvent = {
  event_name: string;
  correlation: correlation.AnonymizedCorrelationHashes;
  facts: Record<string, string | boolean>;
  context: Record<string, unknown>;
  timestamp: Date;
  uuid: UUID;
};

export abstract class DetSysAction {
  nixStoreTrust: NixStoreTrust;

  private actionOptions: ConfidentActionOptions;
  private strictMode: boolean;
  private client: Got;
  private exceptionAttachments: Map<string, PathLike>;
  private archOs: string;
  private executionPhase: ExecutionPhase;
  private nixSystem: string;
  private architectureFetchSuffix: string;
  private sourceParameters: SourceDef;
  private facts: Record<string, string | boolean>;
  private events: DiagnosticEvent[];
  private identity: correlation.AnonymizedCorrelationHashes;

  private determineExecutionPhase(): ExecutionPhase {
    const currentPhase = actionsCore.getState(STATE_KEY_EXECUTION_PHASE);
    if (currentPhase === "") {
      actionsCore.saveState(STATE_KEY_EXECUTION_PHASE, "post");
      return "main";
    } else {
      return "post";
    }
  }

  constructor(actionOptions: ActionOptions) {
    this.actionOptions = makeOptionsConfident(actionOptions);
    this.exceptionAttachments = new Map();
    this.nixStoreTrust = "unknown";
    this.strictMode = getBool("_internal-strict-mode");

    this.events = [];
    this.client = got.extend({
      retry: {
        limit: 3,
        methods: ["GET", "HEAD"],
      },
      hooks: {
        beforeRetry: [
          (error, retryCount) => {
            actionsCore.info(
              `Retrying after error ${error.code}, retry #: ${retryCount}`,
            );
          },
        ],
      },
    });

    // JSON sent to server
    /* eslint-disable camelcase */
    this.facts = {
      $lib: "idslib",
      $lib_version: pkgVersion,
      project: this.actionOptions.name,
      ids_project: this.actionOptions.idsProjectName,
    };

    const params = [
      ["github_action_ref", "GITHUB_ACTION_REF"],
      ["github_action_repository", "GITHUB_ACTION_REPOSITORY"],
      ["github_event_name", "GITHUB_EVENT_NAME"],
      ["$os", "RUNNER_OS"],
      ["arch", "RUNNER_ARCH"],
    ];
    for (const [target, env] of params) {
      const value = process.env[env];
      if (value) {
        this.facts[target] = value;
      }
    }

    this.identity = correlation.identify(this.actionOptions.name);
    this.archOs = platform.getArchOs();
    this.nixSystem = platform.getNixPlatform(this.archOs);

    this.facts.arch_os = this.archOs;
    this.facts.nix_system = this.nixSystem;

    {
      ghActionsCorePlatform
        .getDetails()
        // eslint-disable-next-line github/no-then
        .then((details) => {
          if (details.name !== "unknown") {
            this.addFact(FACT_OS, details.name);
          }
          if (details.version !== "unknown") {
            this.addFact(FACT_OS_VERSION, details.version);
          }
        })
        // eslint-disable-next-line github/no-then
        .catch((e: unknown) => {
          actionsCore.debug(
            `Failure getting platform details: ${stringifyError(e)}`,
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
        `fetchStyle ${this.actionOptions.fetchStyle} is not a valid style`,
      );
    }

    this.sourceParameters = constructSourceParameters(
      this.actionOptions.legacySourcePrefix,
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
  stapleFile(name: string, location: string): void {
    this.exceptionAttachments.set(name, location);
  }

  private setExecutionPhase(): void {
    const phase = actionsCore.getState(STATE_KEY_EXECUTION_PHASE);
    if (phase === "") {
      actionsCore.saveState(STATE_KEY_EXECUTION_PHASE, "post");
      this.executionPhase = "main";
    } else {
      this.executionPhase = "post";
    }
    this.facts.execution_phase = this.executionPhase;
  }

  /**
   * The main execution phase.
   */
  abstract main(): Promise<void>;

  /**
   * The post execution phase.
   */
  abstract post(): Promise<void>;

  /**
   * Execute the Action as defined.
   */
  execute(): void {
    // eslint-disable-next-line github/no-then
    this.executeAsync().catch((error: Error) => {
      // eslint-disable-next-line no-console
      console.log(error);
      process.exitCode = 1;
    });
  }

  // Whether the
  private get isMain(): boolean {
    return this.executionPhase === "main";
  }

  private get isPost(): boolean {
    return this.executionPhase === "post";
  }

  private async executeAsync(): Promise<void> {
    try {
      process.env.DETSYS_CORRELATION = JSON.stringify(
        this.getCorrelationHashes(),
      );

      if (!(await this.preflightRequireNix())) {
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
    } catch (e: unknown) {
      this.addFact(FACT_ENDED_WITH_EXCEPTION, true);

      const reportable = stringifyError(e);

      this.addFact(FACT_FINAL_EXCEPTION, reportable);

      if (this.isPost) {
        actionsCore.warning(reportable);
      } else {
        actionsCore.setFailed(reportable);
      }

      const doGzip = promisify(gzip);

      const exceptionContext: Map<string, string> = new Map();
      for (const [attachmentLabel, filePath] of this.exceptionAttachments) {
        try {
          const logText = readFileSync(filePath);
          const buf = await doGzip(logText);
          exceptionContext.set(
            `staple_value_${attachmentLabel}`,
            buf.toString("base64"),
          );
        } catch (innerError: unknown) {
          exceptionContext.set(
            `staple_failure_${attachmentLabel}`,
            stringifyError(innerError),
          );
        }
      }

      this.recordEvent(EVENT_EXCEPTION, Object.fromEntries(exceptionContext));
    } finally {
      await this.complete();
    }
  }

  addFact(key: string, value: string | boolean): void {
    this.facts[key] = value;
  }

  getDiagnosticsUrl(): URL | undefined {
    return this.actionOptions.diagnosticsUrl;
  }

  getUniqueId(): string {
    return (
      this.identity.run_differentiator ||
      process.env.RUNNER_TRACKING_ID ||
      randomUUID()
    );
  }

  getCorrelationHashes(): correlation.AnonymizedCorrelationHashes {
    return this.identity;
  }

  recordEvent(eventName: string, context: Record<string, unknown> = {}): void {
    this.events.push({
      event_name: `${this.actionOptions.eventPrefix}${eventName}`,
      context,
      correlation: this.identity,
      facts: this.facts,
      timestamp: new Date(),
      uuid: randomUUID(),
    });
  }

  /**
   * Fetches a file in `.xz` format, imports its contents into the Nix store,
   * and returns the path of the executable at `/nix/store/STORE_PATH/bin/${bin}`.
   */
  async unpackClosure(bin: string): Promise<string> {
    const artifact = await this.fetchArtifact();
    const { stdout } = await promisify(exec)(
      `cat "${artifact}" | xz -d | nix-store --import`,
    );
    const paths = stdout.split(os.EOL);
    const lastPath = paths.at(-2);
    return `${lastPath}/bin/${bin}`;
  }

  /**
   * Fetch an artifact, such as a tarball, from the URL determined by the `source-*`
   * inputs or use a provided binary specified by the `source-binary`
   * input.
   */
  private async fetchArtifact(): Promise<string> {
    const sourceBinary = getStringOrNull("source-binary");

    // If source-binary is set, use that. Otherwise fall back to the source-* parameters.
    if (sourceBinary !== null) {
      actionsCore.debug(`Using the provided source binary at ${sourceBinary}`);
      return sourceBinary;
    }

    actionsCore.startGroup(
      `Downloading ${this.actionOptions.name} for ${this.architectureFetchSuffix}`,
    );

    try {
      actionsCore.info(`Fetching from ${this.getSourceUrl()}`);

      const correlatedUrl = this.getSourceUrl();
      correlatedUrl.searchParams.set("ci", "github");
      correlatedUrl.searchParams.set(
        "correlation",
        JSON.stringify(this.identity),
      );

      const versionCheckup = await this.client.head(correlatedUrl);
      if (versionCheckup.headers.etag) {
        const v = versionCheckup.headers.etag;
        this.addFact(FACT_SOURCE_URL_ETAG, v);

        actionsCore.debug(
          `Checking the tool cache for ${this.getSourceUrl()} at ${v}`,
        );
        const cached = await this.getCachedVersion(v);
        if (cached) {
          this.facts["artifact_fetched_from_cache"] = true;
          actionsCore.debug(`Tool cache hit.`);
          return cached;
        }
      }

      this.facts["artifact_fetched_from_cache"] = false;

      actionsCore.debug(
        `No match from the cache, re-fetching from the redirect: ${versionCheckup.url}`,
      );

      const destFile = this.getTemporaryName();
      const fetchStream = this.client.stream(versionCheckup.url);

      await pipeline(
        fetchStream,
        createWriteStream(destFile, {
          encoding: "binary",
          mode: 0o755,
        }),
      );

      if (fetchStream.response?.headers.etag) {
        const v = fetchStream.response.headers.etag;

        try {
          await this.saveCachedVersion(v, destFile);
        } catch (e: unknown) {
          actionsCore.debug(`Error caching the artifact: ${stringifyError(e)}`);
        }
      }

      return destFile;
    } finally {
      actionsCore.endGroup();
    }
  }

  /**
   * Fetches the executable at the URL determined by the `source-*` inputs and
   * other facts, `chmod`s it, and returns the path to the executable on disk.
   */
  async fetchExecutable(): Promise<string> {
    const binaryPath = await this.fetchArtifact();
    await chmod(binaryPath, fs.constants.S_IXUSR | fs.constants.S_IXGRP);
    return binaryPath;
  }

  /**
   * A helper function for failing on error only if strict mode is enabled.
   * This is intended only for CI environments testing Actions themselves.
   */
  failOnError(msg: string): void {
    if (this.strictMode) {
      actionsCore.setFailed(`strict mode failure: ${msg}`);
    }
  }

  private async complete(): Promise<void> {
    this.recordEvent(`complete_${this.executionPhase}`);
    await this.submitEvents();
  }

  private getSourceUrl(): URL {
    const p = this.sourceParameters;

    if (p.url) {
      this.addFact(FACT_SOURCE_URL, p.url);
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

    this.addFact(FACT_SOURCE_URL, fetchUrl.toString());

    return fetchUrl;
  }

  private cacheKey(version: string): string {
    const cleanedVersion = version.replace(/[^a-zA-Z0-9-+.]/g, "");
    return `determinatesystem-${this.actionOptions.name}-${this.architectureFetchSuffix}-${cleanedVersion}`;
  }

  private async getCachedVersion(version: string): Promise<undefined | string> {
    const startCwd = process.cwd();

    try {
      const tempDir = this.getTemporaryName();
      await mkdir(tempDir);
      process.chdir(tempDir);

      // extremely evil shit right here:
      process.env.GITHUB_WORKSPACE_BACKUP = process.env.GITHUB_WORKSPACE;
      delete process.env.GITHUB_WORKSPACE;

      if (
        await actionsCache.restoreCache(
          [this.actionOptions.name],
          this.cacheKey(version),
          [],
          undefined,
          true,
        )
      ) {
        this.recordEvent(EVENT_ARTIFACT_CACHE_HIT);
        return `${tempDir}/${this.actionOptions.name}`;
      }

      this.recordEvent(EVENT_ARTIFACT_CACHE_MISS);
      return undefined;
    } finally {
      process.env.GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE_BACKUP;
      delete process.env.GITHUB_WORKSPACE_BACKUP;
      process.chdir(startCwd);
    }
  }

  private async saveCachedVersion(
    version: string,
    toolPath: string,
  ): Promise<void> {
    const startCwd = process.cwd();

    try {
      const tempDir = this.getTemporaryName();
      await mkdir(tempDir);
      process.chdir(tempDir);
      await copyFile(toolPath, `${tempDir}/${this.actionOptions.name}`);

      // extremely evil shit right here:
      process.env.GITHUB_WORKSPACE_BACKUP = process.env.GITHUB_WORKSPACE;
      delete process.env.GITHUB_WORKSPACE;

      await actionsCache.saveCache(
        [this.actionOptions.name],
        this.cacheKey(version),
        undefined,
        true,
      );
      this.recordEvent(EVENT_ARTIFACT_CACHE_PERSIST);
    } finally {
      process.env.GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE_BACKUP;
      delete process.env.GITHUB_WORKSPACE_BACKUP;
      process.chdir(startCwd);
    }
  }

  private async preflightRequireNix(): Promise<boolean> {
    let nixLocation: string | undefined;

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

    if (this.actionOptions.requireNix === "ignore") {
      return true;
    }

    const currentNotFoundState = actionsCore.getState(STATE_KEY_NIX_NOT_FOUND);
    if (currentNotFoundState === STATE_NOT_FOUND) {
      // It was previously not found, so don't run subsequent actions
      return false;
    }

    if (nixLocation !== undefined) {
      return true;
    }
    actionsCore.saveState(STATE_KEY_NIX_NOT_FOUND, STATE_NOT_FOUND);

    switch (this.actionOptions.requireNix) {
      case "fail":
        actionsCore.setFailed(
          [
            "This action can only be used when Nix is installed.",
            "Add `- uses: DeterminateSystems/nix-installer-action@main` earlier in your workflow.",
          ].join(" "),
        );
        break;
      case "warn":
        actionsCore.warning(
          [
            "This action is in no-op mode because Nix is not installed.",
            "Add `- uses: DeterminateSystems/nix-installer-action@main` earlier in your workflow.",
          ].join(" "),
        );
        break;
    }

    return false;
  }

  private async preflightNixStoreInfo(): Promise<void> {
    let output = "";

    const options: actionsExec.ExecOptions = {};
    options.silent = true;
    options.listeners = {
      stdout: (data) => {
        output += data.toString();
      },
    };

    try {
      output = "";
      await actionsExec.exec("nix", ["store", "info", "--json"], options);
      this.addFact(FACT_NIX_STORE_CHECK_METHOD, "info");
    } catch {
      try {
        // reset output
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
      } else if (parsed.trusted !== undefined) {
        this.addFact(
          FACT_NIX_STORE_CHECK_ERROR,
          `Mysterious trusted value: ${JSON.stringify(parsed.trusted)}`,
        );
      }

      this.addFact(FACT_NIX_STORE_VERSION, JSON.stringify(parsed.version));
    } catch (e: unknown) {
      this.addFact(FACT_NIX_STORE_CHECK_ERROR, stringifyError(e));
    }
  }

  private async submitEvents(): Promise<void> {
    if (this.actionOptions.diagnosticsUrl === undefined) {
      actionsCore.debug(
        "Diagnostics are disabled. Not sending the following events:",
      );
      actionsCore.debug(JSON.stringify(this.events, undefined, 2));
      return;
    }

    const batch = {
      type: "eventlog",
      sent_at: new Date(),
      events: this.events,
    };

    try {
      await this.client.post(this.actionOptions.diagnosticsUrl, {
        json: batch,
      });
    } catch (e: unknown) {
      actionsCore.debug(
        `Error submitting diagnostics event: ${stringifyError(e)}`,
      );
    }
    this.events = [];
  }

  getTemporaryName(): string {
    const _tmpdir = process.env["RUNNER_TEMP"] || tmpdir();
    return path.join(_tmpdir, `${this.actionOptions.name}-${randomUUID()}`);
  }
}

function stringifyError(error: unknown): string {
  return error instanceof Error || typeof error == "string"
    ? error.toString()
    : JSON.stringify(error);
}

function makeOptionsConfident(
  actionOptions: ActionOptions,
): ConfidentActionOptions {
  const idsProjectName = actionOptions.idsProjectName ?? actionOptions.name;

  const finalOpts: ConfidentActionOptions = {
    name: actionOptions.name,
    idsProjectName,
    eventPrefix: actionOptions.eventPrefix || "action:",
    fetchStyle: actionOptions.fetchStyle,
    legacySourcePrefix: actionOptions.legacySourcePrefix,
    requireNix: actionOptions.requireNix,
    diagnosticsUrl: determineDiagnosticsUrl(
      idsProjectName,
      actionOptions.diagnosticsUrl,
    ),
  };

  actionsCore.debug("idslib options:");
  actionsCore.debug(JSON.stringify(finalOpts, undefined, 2));

  return finalOpts;
}

function determineDiagnosticsUrl(
  idsProjectName: string,
  urlOption?: URL | null,
): undefined | URL {
  if (urlOption === null) {
    // Disable diagnostict events
    return undefined;
  }

  if (urlOption !== undefined) {
    // Caller specified a specific diagnostics URL
    return urlOption;
  }

  {
    // Attempt to use the action input's diagnostic-endpoint option.

    // Note: we don't use actionsCore.getInput('diagnostic-endpoint') on purpose:
    // getInput silently converts absent data to an empty string.
    const providedDiagnosticEndpoint = process.env["INPUT_DIAGNOSTIC-ENDPOINT"];
    if (providedDiagnosticEndpoint === "") {
      // User probably explicitly turned it off
      return undefined;
    }

    if (providedDiagnosticEndpoint !== undefined) {
      try {
        return mungeDiagnosticEndpoint(new URL(providedDiagnosticEndpoint));
      } catch (e: unknown) {
        actionsCore.info(
          `User-provided diagnostic endpoint ignored: not a valid URL: ${stringifyError(e)}`,
        );
      }
    }
  }

  try {
    const diagnosticUrl = new URL(IDS_HOST);
    diagnosticUrl.pathname += idsProjectName;
    diagnosticUrl.pathname += "/diagnostics";
    return diagnosticUrl;
  } catch (e: unknown) {
    actionsCore.info(
      `Generated diagnostic endpoint ignored: not a valid URL: ${stringifyError(e)}`,
    );
  }

  return undefined;
}

function mungeDiagnosticEndpoint(inputUrl: URL): URL {
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
  } catch (e: unknown) {
    actionsCore.info(
      `Default or overridden IDS host isn't a valid URL: ${stringifyError(e)}`,
    );
  }

  return inputUrl;
}

// Public exports from other files
export * as inputs from "./inputs.js";
export * as platform from "./platform.js";

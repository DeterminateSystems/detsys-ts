/**
 * @packageDocumentation
 * Determinate Systems' TypeScript library for creating GitHub Actions logic.
 */
// import { version as pkgVersion } from "../package.json";
import * as ghActionsCorePlatform from "./actions-core-platform.js";
import { collectBacktraces } from "./backtrace.js";
import type { CheckIn, Feature } from "./check-in.js";
import * as checksums from "./checksums.js";
import * as correlation from "./correlation.js";
import { IdsHost } from "./ids-host.js";
import * as inputs from "./inputs.js";
import * as log from "./log.js";
import * as platform from "./platform.js";
import type { SourceDef } from "./sourcedef.js";
import * as sourcedef from "./sourcedef.js";
import * as otel from "./telemetry.js";
import * as actionsCache from "@actions/cache";
import * as actionsCore from "@actions/core";
import * as actionsExec from "@actions/exec";
import * as otelApi from "@opentelemetry/api";
import { type Got, type Request, TimeoutError } from "got";
import { exec } from "node:child_process";
import type { UUID } from "node:crypto";
import { randomUUID } from "node:crypto";
import * as nodeFs from "node:fs";
import fs, { chmod, copyFile, mkdir } from "node:fs/promises";
import os, { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { gzip } from "node:zlib";

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
const FACT_SOURCE_CHECKSUMS_SHA256 = "source_checksums_sha256";
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
const STATE_KEY_TRACEPARENT = "detsys_otel_traceparent";

// The check-in feature flag that turns OTLP export on.
const FEATURE_OTEL_EXPORT = "otel-export";

// Span attribute prefixes, so trace data lines up with the facts and events
// already sent to the diagnostics endpoint.
const ATTR_PREFIX_FACT = "detsys.fact.";
const ATTR_PREFIX_EVENT = "detsys.event.";

const DIAGNOSTIC_ENDPOINT_TIMEOUT_MS = 10_000; // 10 seconds in ms
const CHECK_IN_ENDPOINT_TIMEOUT_MS = 1_000; // 1 second in ms
const PROGRAM_NAME_CRASH_DENY_LIST = [
  "nix-expr-tests",
  "nix-store-tests",
  "nix-util-tests",
];

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

  // The URL suffix to send diagnostics events to.
  //
  // The final URL is constructed via IDS_HOST/idsProjectName/diagnosticsSuffix.
  //
  // Default: `diagnostics`.
  diagnosticsSuffix?: string;

  // Collect backtraces from segfaults and other failures from binaries that start with these names.
  //
  // Default: `[ "nix", "determinate-nixd", ActionOptions.name ]`.
  binaryNamePrefixes?: string[];

  // Do NOT collect backtraces from segfaults and other failures from binaries with exact these names.
  //
  // Default: `[ "nix-expr-tests" ]`.
  binaryNamesDenyList?: string[];
};

/**
 * A confident version of Options, where defaults have been resolved into final values.
 */
export type ConfidentActionOptions = {
  name: string;
  idsProjectName: string;
  eventPrefix: string;
  fetchStyle: FetchSuffixStyle;
  legacySourcePrefix?: string;
  requireNix: NixRequirementHandling;
  providedDiagnosticsUrl?: URL;
  binaryNamePrefixes: string[];
  binaryNamesDenyList: string[];
};

/**
 * The context attached to a recorded event. Values may nest one level deep,
 * which is how PostHog-style properties like `$group_set` are expressed.
 */
export type EventContext = Record<
  string,
  | boolean
  | string
  | number
  | undefined
  | Record<string, boolean | string | number | undefined>
>;

/**
 * An event to send to the diagnostic endpoint of i.d.s.
 */
export type DiagnosticEvent = {
  // Note: putting a Map in here won't serialize to json properly.
  // It'll just be {} on serialization.
  name: string;
  distinct_id?: string;
  uuid: UUID;
  timestamp: Date;

  properties: Record<string, unknown>;
};

const determinateStateDir = "/var/lib/determinate";
const determinateIdentityFile = path.join(determinateStateDir, "identity.json");

const isRoot = typeof process.geteuid === "function" && process.geteuid() === 0;

/** Create the Determinate state directory by escalating via sudo */
async function sudoEnsureDeterminateStateDir(): Promise<void> {
  const code = await actionsExec.exec("sudo", [
    "mkdir",
    "-p",
    determinateStateDir,
  ]);

  if (code !== 0) {
    throw new Error(`sudo mkdir -p exit: ${code}`);
  }
}

/** Ensures the Determinate state directory exists, escalating if necessary */
async function ensureDeterminateStateDir(): Promise<void> {
  if (isRoot) {
    await mkdir(determinateStateDir, { recursive: true });
  } else {
    return sudoEnsureDeterminateStateDir();
  }
}

/** Writes correlation hashes to the Determinate state directory by writing to a `sudo tee` pipe */
async function sudoWriteCorrelationHashes(hashes: string): Promise<void> {
  const buffer = Buffer.from(hashes);

  const code = await actionsExec.exec(
    "sudo",
    ["tee", determinateIdentityFile],
    {
      input: buffer,

      // Ignore output from tee
      outStream: nodeFs.createWriteStream("/dev/null"),
    },
  );

  if (code !== 0) {
    throw new Error(`sudo tee exit: ${code}`);
  }
}

/** Writes correlation hashes to the Determinate state directory, escalating if necessary */
async function writeCorrelationHashes(hashes: string): Promise<void> {
  await ensureDeterminateStateDir();

  if (isRoot) {
    await fs.writeFile(determinateIdentityFile, hashes, "utf-8");
  } else {
    return sudoWriteCorrelationHashes(hashes);
  }
}

export abstract class DetSysAction {
  nixStoreTrust: NixStoreTrust;
  strictMode: boolean;

  private actionOptions: ConfidentActionOptions;
  private exceptionAttachments: Map<string, nodeFs.PathLike>;
  private archOs: string;
  private executionPhase: ExecutionPhase;
  private nixSystem: string;
  private architectureFetchSuffix: string;
  private sourceParameters: SourceDef;
  private facts: Record<string, string | boolean | number>;
  private events: DiagnosticEvent[];
  private identity: correlation.CorrelationProperties;
  private idsHost: IdsHost;
  private features: { [k: string]: Feature };
  private featureEventMetadata: { [k: string]: string | boolean };
  private telemetry: otel.Telemetry;

  // The root span for this execution phase. Undefined until the phase span is
  // opened, and when OpenTelemetry export is disabled.
  private phaseSpan?: otelApi.Span;

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
    this.idsHost = new IdsHost(
      this.actionOptions.idsProjectName,
      actionOptions.diagnosticsSuffix,
      // Note: we don't use actionsCore.getInput('diagnostic-endpoint') on purpose:
      // getInput silently converts absent data to an empty string.
      process.env["INPUT_DIAGNOSTIC-ENDPOINT"],
      inputs.getNumberOrUndefined("timeout-request"),
    );
    this.telemetry = new otel.Telemetry();
    this.exceptionAttachments = new Map();
    this.nixStoreTrust = "unknown";
    this.strictMode = inputs.getBool("_internal-strict-mode");

    if (
      inputs.getBoolOrUndefined(
        "_internal-obliterate-actions-id-token-request-variables",
      ) === true
    ) {
      process.env["ACTIONS_ID_TOKEN_REQUEST_URL"] = undefined;
      process.env["ACTIONS_ID_TOKEN_REQUEST_TOKEN"] = undefined;
    }

    this.features = {};
    this.featureEventMetadata = {};
    this.events = [];

    this.getCrossPhaseId();
    this.collectBacktraceSetup();

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

    this.identity = correlation.identify();
    this.archOs = platform.getArchOs();
    this.nixSystem = platform.getNixPlatform(this.archOs);

    this.facts.$app_name = `${this.actionOptions.name}/action`;
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

    this.sourceParameters = sourcedef.constructSourceParameters(
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

  getTemporaryName(): string {
    const tmpDir = process.env["RUNNER_TEMP"] || tmpdir();
    return path.join(tmpDir, `${this.actionOptions.name}-${randomUUID()}`);
  }

  addFact(key: string, value: string | boolean | number): void {
    this.facts[key] = value;

    // Facts describe the run as a whole, so they belong on the phase's root
    // span rather than on whichever span happens to be active.
    this.phaseSpan?.setAttribute(`${ATTR_PREFIX_FACT}${key}`, value);
  }

  async getDiagnosticsUrl(): Promise<URL | undefined> {
    return await this.idsHost.getDiagnosticsUrl();
  }

  getUniqueId(): string {
    return (
      this.identity.github_workflow_run_differentiator_hash ||
      process.env.RUNNER_TRACKING_ID ||
      randomUUID()
    );
  }

  // This ID will be saved in the action's state, to be persisted across phase steps
  getCrossPhaseId(): string {
    let crossPhaseId = actionsCore.getState(STATE_KEY_CROSS_PHASE_ID);

    if (crossPhaseId === "") {
      crossPhaseId = randomUUID();
      actionsCore.saveState(STATE_KEY_CROSS_PHASE_ID, crossPhaseId);
    }

    return crossPhaseId;
  }

  getCorrelationHashes(): correlation.CorrelationProperties {
    return this.identity;
  }

  recordEvent(eventName: string, context: EventContext = {}): void {
    const prefixedName =
      eventName === "$feature_flag_called" || eventName === "$groupidentify"
        ? eventName
        : `${this.actionOptions.eventPrefix}${eventName}`;

    this.events.push({
      name: prefixedName,

      // Use the anon distinct ID as the distinct ID until we actually have a distinct ID in the future
      distinct_id: this.identity.$anon_distinct_id,

      // distinct_id
      uuid: randomUUID(),
      timestamp: new Date(),

      properties: {
        ...context,
        ...this.identity,
        ...this.facts,
        ...Object.fromEntries(
          Object.entries(this.featureEventMetadata).map<
            [string, string | boolean]
          >(([name, variant]) => [`$feature/${name}`, variant]),
        ),
      },
    });

    // Mirror the event onto the trace. Prefer whichever span is active so the
    // event lands on the operation that produced it, and fall back to the
    // phase's root span for events recorded outside any nested span.
    const span = otelApi.trace.getActiveSpan() ?? this.phaseSpan;
    span?.addEvent(prefixedName, toAttributes(context, ATTR_PREFIX_EVENT));
  }

  /**
   * Unpacks the closure returned by `fetchArtifact()`, imports the
   * contents into the Nix store, and returns the path of the executable at
   * `/nix/store/STORE_PATH/bin/${bin}`.
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
   * Fetches the executable at the URL determined by the `source-*` inputs and
   * other facts, `chmod`s it, and returns the path to the executable on disk.
   */
  async fetchExecutable(): Promise<string> {
    const binaryPath = await this.fetchArtifact();
    await chmod(
      binaryPath,
      nodeFs.constants.S_IXUSR | nodeFs.constants.S_IXGRP,
    );
    return binaryPath;
  }

  private get isMain(): boolean {
    return this.executionPhase === "main";
  }

  private get isPost(): boolean {
    return this.executionPhase === "post";
  }

  private async executeAsync(): Promise<void> {
    // The phase span can't open until check-in has resolved the feature flag
    // that decides whether telemetry is exported at all, so remember when the
    // phase really began and backdate the span to here.
    const phaseStartTime = new Date();

    try {
      await this.checkIn();
      await this.startTelemetry();

      this.startPhaseSpan(phaseStartTime);

      await this.withPhaseSpanActive(async () => {
        const correlationHashes = JSON.stringify(this.getCorrelationHashes());
        process.env.DETSYS_CORRELATION = correlationHashes;
        try {
          await writeCorrelationHashes(correlationHashes);
        } catch (error) {
          this.recordEvent(EVENT_STORE_IDENTITY_FAILED, {
            error: String(error),
          });
        }

        if (!(await this.preflightRequireNix())) {
          this.recordEvent(EVENT_PREFLIGHT_REQUIRE_NIX_DENIED);
          return;
        } else {
          await this.preflightNixStoreInfo();
          await this.preflightNixVersion();
          this.addFact(FACT_NIX_STORE_TRUST, this.nixStoreTrust);
        }

        if (this.isMain) {
          this.recordGroup();
          await this.main();

          // Run the preflight of the nix version a second time so our "shutdown" events have updated version info.
          await this.preflightNixVersion();
        } else if (this.isPost) {
          await this.post();
        }
      });

      this.addFact(FACT_ENDED_WITH_EXCEPTION, false);
    } catch (e: unknown) {
      this.addFact(FACT_ENDED_WITH_EXCEPTION, true);

      const reportable = stringifyError(e);

      this.addFact(FACT_FINAL_EXCEPTION, reportable);

      if (this.phaseSpan !== undefined) {
        otel.recordSpanError(this.phaseSpan, e);
      }

      if (this.isPost) {
        log.warning(reportable);
      } else {
        log.setFailed(reportable);
      }

      const doGzip = promisify(gzip);

      const exceptionContext: Map<string, string> = new Map();
      for (const [attachmentLabel, filePath] of this.exceptionAttachments) {
        try {
          const logText = nodeFs.readFileSync(filePath);
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
      // Still inside the phase span: backtrace collection is part of the phase,
      // and left to run outside the span's context it would start a root span
      // of its own, in a second trace.
      await this.withPhaseSpanActive(async () => {
        if (this.isPost) {
          await this.collectBacktraces();
        }
      });

      await this.complete();
    }
  }

  /**
   * Run `fn` with the phase's root span as the active span, so anything it
   * starts is parented into this phase's trace.
   */
  private async withPhaseSpanActive<T>(fn: () => Promise<T>): Promise<T> {
    const span = this.phaseSpan;

    if (span === undefined) {
      return await fn();
    }

    return await otelApi.context.with(
      otelApi.trace.setSpan(otelApi.context.active(), span),
      fn,
    );
  }

  /**
   * Start OpenTelemetry export, if this run is opted in.
   *
   * This has to run after check-in, because check-in is what resolves the
   * feature flag. When it doesn't start, the OpenTelemetry API stays in its
   * no-op state: every span and log record below silently does nothing, so
   * there is no need to branch on it at the call sites.
   */
  private async startTelemetry(): Promise<void> {
    const enabledByFlag =
      this.getFeature(FEATURE_OTEL_EXPORT)?.variant === true;

    // An explicitly configured endpoint opts in regardless of the flag, so the
    // export can be exercised without waiting on a server-side rollout.
    const enabledByConfig = otel.otlpExplicitlyConfigured();

    if (!enabledByFlag && !enabledByConfig) {
      actionsCore.debug("OpenTelemetry export is not enabled for this run.");
      return;
    }

    const endpoint = otel.otlpEndpoint();
    if (endpoint === undefined) {
      actionsCore.debug(
        "OpenTelemetry export is disabled: no OTLP endpoint resolved.",
      );
      return;
    }

    this.telemetry.start({
      serviceName: this.actionOptions.name,
      serviceVersion: pkgVersion,
      endpoint,
      headers: otel.otlpHeaders(),
      requestTimeoutMs: DIAGNOSTIC_ENDPOINT_TIMEOUT_MS,
      resourceAttributes: this.telemetryResourceAttributes(),
    });
  }

  /**
   * Open the root span for this execution phase.
   *
   * `main` and `post` are separate processes, so the main phase publishes its
   * span as a W3C traceparent in the Action's state and the post phase adopts
   * it as a parent. That puts both phases of a run in one trace.
   */
  private startPhaseSpan(startTime: Date): otelApi.Span {
    const parentContext = otel.contextFromTraceparent(
      actionsCore.getState(STATE_KEY_TRACEPARENT) || undefined,
    );

    const span = otel
      .getTracer()
      .startSpan(
        `${this.actionOptions.name}:${this.executionPhase}`,
        { startTime },
        parentContext,
      );

    // Facts collected before the span existed -- most of them are gathered in
    // the constructor -- still describe this run, so replay them onto it.
    for (const [key, value] of Object.entries(this.facts)) {
      span.setAttribute(`${ATTR_PREFIX_FACT}${key}`, value);
    }

    if (this.isMain) {
      const traceparent = otel.traceparentOf(span);
      if (traceparent !== undefined) {
        actionsCore.saveState(STATE_KEY_TRACEPARENT, traceparent);
      }
    }

    this.phaseSpan = span;

    return span;
  }

  /**
   * The stable, run-scoped attributes attached to every span and log record.
   *
   * These carry the same hashed, non-identifying correlation data the
   * diagnostics endpoint already receives.
   */
  private telemetryResourceAttributes(): otelApi.Attributes {
    return {
      "detsys.project": this.actionOptions.name,
      "detsys.ids_project": this.actionOptions.idsProjectName,
      "detsys.execution_phase": this.executionPhase,
      "detsys.cross_phase_id": this.getCrossPhaseId(),
      "detsys.anon_distinct_id": this.identity.$anon_distinct_id,
      "detsys.session_id": this.identity.$session_id,
      "detsys.correlation_source": this.identity.correlation_source,
      "detsys.github_repository_hash": this.identity.github_repository_hash,
      "detsys.github_organization_hash":
        this.identity.$groups["github_organization"],
      "detsys.github_workflow_hash": this.identity.github_workflow_hash,
      "detsys.github_workflow_job_hash": this.identity.github_workflow_job_hash,
      "detsys.github_workflow_run_hash": this.identity.github_workflow_run_hash,
      "detsys.github_workflow_run_differentiator_hash":
        this.identity.github_workflow_run_differentiator_hash,
      "detsys.arch_os": this.archOs,
      "detsys.nix_system": this.nixSystem,
      "ci.provider": "github-actions",

      // The feature flags this run resolved, so trace data can be sliced by
      // the same variants the events are.
      ...Object.fromEntries(
        Object.entries(this.featureEventMetadata).map<
          [string, string | boolean]
        >(([name, variant]) => [`detsys.feature.${name}`, variant]),
      ),
    };
  }

  /**
   * The W3C `traceparent` identifying the span currently in progress.
   *
   * Hand this to a child process -- as `$TRACEPARENT` -- so that its own
   * OpenTelemetry data joins this Action's trace. Returns undefined when
   * OpenTelemetry export is disabled for this run.
   */
  getTraceparent(): string | undefined {
    return otel.traceparentOf(otelApi.trace.getActiveSpan() ?? this.phaseSpan);
  }

  /**
   * Environment variables that let a spawned binary export into this Action's
   * trace: the current `$TRACEPARENT`, and the OTLP endpoint and credentials
   * to send to.
   *
   * Merge this into the environment of any child process you want traced. It
   * is empty when OpenTelemetry export is disabled, so merging it is always
   * safe.
   */
  async getTelemetryEnvironment(): Promise<Record<string, string>> {
    if (!this.telemetry.enabled) {
      return {};
    }

    const environment: Record<string, string> = {};

    const traceparent = this.getTraceparent();
    if (traceparent !== undefined) {
      environment["TRACEPARENT"] = traceparent;
    }

    const endpoint = otel.otlpEndpoint();
    if (endpoint !== undefined) {
      environment["OTEL_EXPORTER_OTLP_ENDPOINT"] = endpoint.toString();
    }

    // Without this the child reaches the collector unauthenticated and its
    // spans are refused. Left undefined when we have no headers of our own,
    // so that a value the user set survives into the child.
    const headers = otel.encodeOtlpHeaders(otel.otlpHeaders());
    if (headers !== undefined) {
      environment["OTEL_EXPORTER_OTLP_HEADERS"] = headers;
    }

    return environment;
  }

  async getClient(): Promise<Got> {
    return await this.idsHost.getGot(
      (incitingError: unknown, prevUrl: URL, nextUrl: URL) => {
        this.recordPlausibleTimeout(incitingError);

        this.recordEvent("ids-failover", {
          previousUrl: prevUrl.toString(),
          nextUrl: nextUrl.toString(),
        });
      },
    );
  }

  private async checkIn(): Promise<void> {
    const checkin = await this.requestCheckIn();
    if (checkin === undefined) {
      return;
    }

    this.features = checkin.options;
    for (const [key, feature] of Object.entries(this.features)) {
      this.featureEventMetadata[key] = feature.variant;
    }

    const impactSymbol: Map<string, string> = new Map([
      ["none", "⚪"],
      ["maintenance", "🛠️"],
      ["minor", "🟡"],
      ["major", "🟠"],
      ["critical", "🔴"],
    ]);
    const defaultImpactSymbol = "🔵";

    if (checkin.status !== null) {
      const summaries: string[] = [];

      for (const incident of checkin.status.incidents) {
        summaries.push(
          `${impactSymbol.get(incident.impact) || defaultImpactSymbol} ${incident.status.replace("_", " ")}: ${incident.name} (${incident.shortlink})`,
        );
      }

      for (const maintenance of checkin.status.scheduled_maintenances) {
        summaries.push(
          `${impactSymbol.get(maintenance.impact) || defaultImpactSymbol} ${maintenance.status.replace("_", " ")}: ${maintenance.name} (${maintenance.shortlink})`,
        );
      }

      if (summaries.length > 0) {
        actionsCore.info(
          // Bright red, Bold, Underline
          `${"\u001b[0;31m"}${"\u001b[1m"}${"\u001b[4m"}${checkin.status.page.name} Status`,
        );
        for (const notice of summaries) {
          actionsCore.info(notice);
        }
        actionsCore.info(`See: ${checkin.status.page.url}`);
        actionsCore.info(``);
      }
    }
  }

  getFeature(name: string): Feature | undefined {
    if (!this.features.hasOwnProperty(name)) {
      return undefined;
    }

    const result = this.features[name];
    if (result === undefined) {
      return undefined;
    }

    this.recordEvent("$feature_flag_called", {
      $feature_flag: name,
      $feature_flag_response: result.variant,
    });

    return result;
  }

  private recordGroup(): void {
    const ghorg_hash = this.identity.$groups["github_organization"];
    const ghorg_name = process.env["GITHUB_REPOSITORY_OWNER"];

    if (ghorg_hash !== undefined && ghorg_name !== undefined) {
      this.recordEvent("$groupidentify", {
        $group_type: "github_organization",
        $group_key: ghorg_hash,
        $group_set: {
          name: ghorg_name,
        },
      });
    }
  }

  /**
   * Check in to install.determinate.systems, to accomplish three things:
   *
   * 1. Preflight the server selected from IdsHost, to increase the chances of success.
   * 2. Fetch any incidents and maintenance events to let users know in case things are weird.
   * 3. Get feature flag data so we can gently roll out new features.
   */
  private async requestCheckIn(): Promise<CheckIn | undefined> {
    for (
      let attemptsRemaining = 5;
      attemptsRemaining > 0;
      attemptsRemaining--
    ) {
      const checkInUrl = await this.getCheckInUrl();
      if (checkInUrl === undefined) {
        return undefined;
      }

      try {
        actionsCore.debug(`Preflighting via ${checkInUrl}`);

        const props = {
          // Use a distinct_id when we actually have one
          distinct_id: this.identity.$anon_distinct_id,
          anon_distinct_id: this.identity.$anon_distinct_id,
          groups: this.identity.$groups,
          person_properties: {
            ci: "github",

            ...this.identity,
            ...this.facts,
          },
        };

        return await (
          await this.getClient()
        )
          .post(checkInUrl, {
            json: props,
            timeout: {
              request: CHECK_IN_ENDPOINT_TIMEOUT_MS,
            },
          })
          .json();
      } catch (e: unknown) {
        this.recordPlausibleTimeout(e);
        actionsCore.debug(`Error checking in: ${stringifyError(e)}`);
        this.idsHost.markCurrentHostBroken();
      }
    }

    return undefined;
  }

  private recordPlausibleTimeout(e: unknown): void {
    // see: https://github.com/sindresorhus/got/blob/895e463fa699d6f2e4b2fc01ceb3b2bb9e157f4c/documentation/8-errors.md
    if (e instanceof TimeoutError && "timings" in e && "request" in e) {
      const reportContext: {
        [index: string]: string | number | undefined;
      } = {
        url: e.request.requestUrl?.toString(),
        retry_count: e.request.retryCount,
      };

      for (const [key, value] of Object.entries(e.timings.phases)) {
        if (Number.isFinite(value)) {
          reportContext[`timing_phase_${key}`] = value;
        }
      }

      this.recordEvent("timeout", reportContext);
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
  private async fetchArtifact(): Promise<string> {
    const sourceBinary = inputs.getStringOrNull("source-binary");

    // If source-binary is set, use that. Otherwise fall back to the source-* parameters.
    if (sourceBinary !== null && sourceBinary !== "") {
      log.debug(`Using the provided source binary at ${sourceBinary}`);
      return sourceBinary;
    }

    return await otel.withSpan(
      "fetch_artifact",
      async () => {
        const expectedArtifactHash = await this.resolveExpectedArtifactHash();

        actionsCore.startGroup(
          `Downloading ${this.actionOptions.name} for ${this.architectureFetchSuffix}`,
        );

        try {
          log.info(`Fetching from ${await this.getSourceUrl()}`);

          const correlatedUrl = await this.getSourceUrl();
          correlatedUrl.searchParams.set("ci", "github");
          correlatedUrl.searchParams.set(
            "correlation",
            JSON.stringify(this.identity),
          );

          const versionCheckup = await (
            await this.getClient()
          ).head(correlatedUrl);
          if (versionCheckup.headers.etag) {
            const v = versionCheckup.headers.etag;
            this.addFact(FACT_SOURCE_URL_ETAG, v);

            log.debug(
              `Checking the tool cache for ${await this.getSourceUrl()} at ${v}`,
            );
            const cached = await this.getCachedVersion(v, expectedArtifactHash);
            if (cached) {
              this.facts[FACT_ARTIFACT_FETCHED_FROM_CACHE] = true;
              log.debug(`Tool cache hit.`);
              await this.verifyArtifactHash(cached, expectedArtifactHash);
              return cached;
            }
          }

          this.facts[FACT_ARTIFACT_FETCHED_FROM_CACHE] = false;

          log.debug(
            `No match from the cache, re-fetching from the redirect: ${versionCheckup.url}`,
          );

          const destFile = this.getTemporaryName();

          const fetchStream = await this.downloadFile(
            new URL(versionCheckup.url),
            destFile,
          );

          await this.verifyArtifactHash(destFile, expectedArtifactHash);

          if (fetchStream.response?.headers.etag) {
            const v = fetchStream.response.headers.etag;

            try {
              await this.saveCachedVersion(v, destFile, expectedArtifactHash);
            } catch (e: unknown) {
              log.debug(`Error caching the artifact: ${stringifyError(e)}`);
            }
          }

          return destFile;
        } catch (e: unknown) {
          this.recordPlausibleTimeout(e);
          throw e;
        } finally {
          actionsCore.endGroup();
        }
      },
      {
        "detsys.artifact": this.actionOptions.name,
        "detsys.architecture_fetch_suffix": this.architectureFetchSuffix,
      },
    );
  }

  /**
   * Read the `source-checksums-url` and `source-checksums-sha256` inputs and,
   * if both are set, fetch the checksums file, verify its hash matches the
   * pin, parse it, and return the expected hash for the artifact matching
   * this runner's `${name}-${architectureFetchSuffix}`. Returns `null` when
   * verification is opted out (both inputs unset).
   */
  private async resolveExpectedArtifactHash(): Promise<string | null> {
    const checksumsUrl = inputs.getStringOrNull("source-checksums-url");
    const checksumsSha256 = inputs.getStringOrNull("source-checksums-sha256");

    if (checksumsUrl === null && checksumsSha256 === null) {
      return null;
    }
    if (checksumsUrl === null || checksumsSha256 === null) {
      throw new Error(
        "`source-checksums-url` and `source-checksums-sha256` must be set together",
      );
    }

    sourcedef.assertChecksumSourceIsPinned(this.sourceParameters);

    const expectedFileHash = checksumsSha256.toLowerCase();
    this.addFact(FACT_SOURCE_CHECKSUMS_SHA256, expectedFileHash);

    const parsedUrl = new URL(checksumsUrl);
    const safeUrl = parsedUrl.origin + parsedUrl.pathname;

    actionsCore.info(`Fetching checksums file from ${safeUrl}`);
    const response = await (await this.getClient()).get(checksumsUrl);
    const body = response.body;

    const actualFileHash = checksums.sha256OfBuffer(body);
    if (actualFileHash !== expectedFileHash) {
      throw new Error(
        `Checksums file hash mismatch at ${safeUrl}: expected ${expectedFileHash}, got ${actualFileHash}`,
      );
    }

    const wanted = `${this.actionOptions.name}-${this.architectureFetchSuffix}`;
    const hashes = checksums.parseChecksumsFile(body);
    const artifactHash = hashes.get(wanted);
    if (artifactHash === undefined) {
      throw new Error(`No entry for ${wanted} in checksums file at ${safeUrl}`);
    }
    return artifactHash;
  }

  /**
   * Verify a downloaded artifact's SHA-256 matches the expected hash. No-op
   * when `expected` is `null` (verification disabled).
   */
  private async verifyArtifactHash(
    filePath: string,
    expected: string | null,
  ): Promise<void> {
    if (expected === null) {
      return;
    }
    const actual = await checksums.sha256OfFile(filePath);
    if (actual !== expected) {
      throw new Error(
        `Artifact hash mismatch for ${this.architectureFetchSuffix}: expected ${expected}, got ${actual}`,
      );
    }
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

  private async downloadFile(
    url: URL,
    destination: nodeFs.PathLike,
  ): Promise<Request> {
    return await otel.withSpan("download_file", async () =>
      this.download(url, destination),
    );
  }

  private async download(
    url: URL,
    destination: nodeFs.PathLike,
  ): Promise<Request> {
    const client = await this.getClient();

    return new Promise((resolve, reject) => {
      // Current stream handle
      let writeStream: nodeFs.WriteStream | undefined;

      // Sentinel condition in case we want to abort retrying due to FS issues
      let failed = false;

      const retry = (stream: Request): void => {
        if (writeStream) {
          writeStream.destroy();
        }

        writeStream = nodeFs.createWriteStream(destination, {
          encoding: "binary",
          mode: 0o755,
        });

        writeStream.once("error", (error) => {
          // Set failed here since promise rejections don't impact control flow
          failed = true;
          reject(error);
        });

        writeStream.on("finish", () => {
          if (!failed) {
            resolve(stream);
          }
        });

        stream.once("retry", (_count, _error, createRetryStream) => {
          // Optional: check `failed' here in case you want to stop retrying
          retry(createRetryStream());
        });

        // Now that all the handlers have been set up we can pipe from the HTTP
        // stream to disk
        stream.pipe(writeStream);
      };

      // Begin the retry logic by giving it a fresh got.Request
      retry(client.stream(url));
    });
  }

  private async complete(): Promise<void> {
    // Recorded before the span ends, so it still lands on the trace.
    this.recordEvent(`complete_${this.executionPhase}`);

    this.phaseSpan?.end();
    this.phaseSpan = undefined;

    await this.submitEvents();

    // The process exits as soon as we return, so anything still buffered has
    // to go out now.
    await this.telemetry.shutdown();
  }

  private async getCheckInUrl(): Promise<URL | undefined> {
    const checkInUrl = await this.idsHost.getDynamicRootUrl();

    if (checkInUrl === undefined) {
      return undefined;
    }

    checkInUrl.pathname += "check-in";
    return checkInUrl;
  }

  private async getSourceUrl(): Promise<URL> {
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

  private cacheKey(version: string, expectedHash: string | null): string {
    const cleanedVersion = version.replace(/[^a-zA-Z0-9-+.]/g, "");
    const hashSuffix = expectedHash ? `-h${expectedHash}` : "";
    return `determinatesystem-${this.actionOptions.name}-${this.architectureFetchSuffix}-${cleanedVersion}${hashSuffix}`;
  }

  private async getCachedVersion(
    version: string,
    expectedHash: string | null,
  ): Promise<undefined | string> {
    return await otel.withSpan("artifact_cache_restore", async (span) => {
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
            this.cacheKey(version, expectedHash),
            [],
            undefined,
            true,
          )
        ) {
          span.setAttribute("detsys.cache_hit", true);
          this.recordEvent(EVENT_ARTIFACT_CACHE_HIT);
          return `${tempDir}/${this.actionOptions.name}`;
        }

        span.setAttribute("detsys.cache_hit", false);
        this.recordEvent(EVENT_ARTIFACT_CACHE_MISS);
        return undefined;
      } finally {
        process.env.GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE_BACKUP;
        delete process.env.GITHUB_WORKSPACE_BACKUP;
        process.chdir(startCwd);
      }
    });
  }

  private async saveCachedVersion(
    version: string,
    toolPath: string,
    expectedHash: string | null,
  ): Promise<void> {
    return await otel.withSpan("artifact_cache_persist", async () => {
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
          this.cacheKey(version, expectedHash),
          undefined,
          true,
        );
        this.recordEvent(EVENT_ARTIFACT_CACHE_PERSIST);
      } finally {
        process.env.GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE_BACKUP;
        delete process.env.GITHUB_WORKSPACE_BACKUP;
        process.chdir(startCwd);
      }
    });
  }

  private collectBacktraceSetup(): void {
    if (!process.env.DETSYS_BACKTRACE_COLLECTOR) {
      actionsCore.exportVariable(
        "DETSYS_BACKTRACE_COLLECTOR",
        this.getCrossPhaseId(),
      );

      actionsCore.saveState(STATE_BACKTRACE_START_TIMESTAMP, Date.now());
    }
  }

  private async collectBacktraces(): Promise<void> {
    try {
      if (process.env.DETSYS_BACKTRACE_COLLECTOR !== this.getCrossPhaseId()) {
        return;
      }

      const backtraces = await otel.withSpan("collect_backtraces", async () =>
        collectBacktraces(
          this.actionOptions.binaryNamePrefixes,
          this.actionOptions.binaryNamesDenyList,
          parseInt(actionsCore.getState(STATE_BACKTRACE_START_TIMESTAMP)),
        ),
      );
      log.debug(`Backtraces identified: ${backtraces.size}`);
      if (backtraces.size > 0) {
        this.recordEvent(EVENT_BACKTRACES, Object.fromEntries(backtraces));
      }
    } catch (innerError: unknown) {
      actionsCore.debug(
        `Error collecting backtraces: ${stringifyError(innerError)}`,
      );
    }
  }

  private async preflightRequireNix(): Promise<boolean> {
    return await otel.withSpan("preflight_require_nix", async () => {
      let nixLocation: string | undefined;

      const pathParts = (process.env["PATH"] || "").split(":");
      for (const location of pathParts) {
        const candidateNix = path.join(location, "nix");

        try {
          await fs.access(candidateNix, fs.constants.X_OK);
          log.debug(`Found Nix at ${candidateNix}`);
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

      const currentNotFoundState = actionsCore.getState(
        STATE_KEY_NIX_NOT_FOUND,
      );
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
          log.setFailed(
            [
              "This action can only be used when Nix is installed.",
              "Add `- uses: DeterminateSystems/determinate-nix-action@v3` earlier in your workflow.",
            ].join(" "),
          );
          break;
        case "warn":
          log.warning(
            [
              "This action is in no-op mode because Nix is not installed.",
              "Add `- uses: DeterminateSystems/determinate-nix-action@v3` earlier in your workflow.",
            ].join(" "),
          );
          break;
      }

      return false;
    });
  }

  private async preflightNixStoreInfo(): Promise<void> {
    return await otel.withSpan("preflight_nix_store_info", async (span) => {
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
        if (parsed.trusted === true || parsed.trusted === 1) {
          this.nixStoreTrust = "trusted";
        } else if (parsed.trusted === false || parsed.trusted === 0) {
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

      span.setAttribute("detsys.nix_store_trust", this.nixStoreTrust);
    });
  }

  private async preflightNixVersion(): Promise<void> {
    return await otel.withSpan("preflight_nix_version", async (span) => {
      let output = "unknown";

      try {
        ({ stdout: output } = await actionsExec.getExecOutput(
          "nix",
          ["--version"],
          {
            silent: true,
          },
        ));
        output = output.trim() || "unknown";
      } catch {
        // That's fine.
      }

      this.addFact(FACT_NIX_VERSION, output);
      span.setAttribute("detsys.nix_version", output);
    });
  }

  private async submitEvents(): Promise<void> {
    const diagnosticsUrl = await this.idsHost.getDiagnosticsUrl();
    if (diagnosticsUrl === undefined) {
      actionsCore.debug(
        "Diagnostics are disabled. Not sending the following events:",
      );
      actionsCore.debug(JSON.stringify(this.events, undefined, 2));
      return;
    }

    const batch = {
      sent_at: new Date(),
      batch: this.events,
    };

    try {
      await (
        await this.getClient()
      ).post(diagnosticsUrl, {
        json: batch,
        timeout: {
          request: DIAGNOSTIC_ENDPOINT_TIMEOUT_MS,
        },
      });
    } catch (err: unknown) {
      this.recordPlausibleTimeout(err);

      actionsCore.debug(
        `Error submitting diagnostics event to ${diagnosticsUrl}: ${stringifyError(err)}`,
      );
    }
    this.events = [];
  }
}

function stringifyError(error: unknown): string {
  return error instanceof Error || typeof error == "string"
    ? error.toString()
    : JSON.stringify(error);
}

/**
 * Flatten an event context into OpenTelemetry attributes.
 *
 * Attributes are a flat map of primitives, so the one level of nesting an
 * EventContext permits is joined with a dot, and undefined values are dropped
 * rather than serialized as the string "undefined".
 */
function toAttributes(
  context: EventContext,
  prefix: string,
): otelApi.Attributes {
  const attributes: otelApi.Attributes = {};

  const set = (
    key: string,
    value: boolean | string | number | undefined,
  ): void => {
    if (value !== undefined) {
      attributes[`${prefix}${key}`] = value;
    }
  };

  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "object" && value !== null) {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        set(`${key}.${nestedKey}`, nestedValue);
      }
    } else {
      set(key, value);
    }
  }

  return attributes;
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
    binaryNamePrefixes: actionOptions.binaryNamePrefixes ?? [
      "nix",
      "determinate-nixd",
      actionOptions.name,
    ],
    binaryNamesDenyList:
      actionOptions.binaryNamesDenyList ?? PROGRAM_NAME_CRASH_DENY_LIST,
  };

  actionsCore.debug("idslib options:");
  actionsCore.debug(JSON.stringify(finalOpts, undefined, 2));

  return finalOpts;
}

// Public exports from other files
export type {
  CheckIn,
  Feature,
  Incident,
  Maintenance,
  Page,
  StatusSummary,
} from "./check-in.js";
export type { CorrelationProperties } from "./correlation.js";
export { stringifyError } from "./errors.js";
export { IdsHost } from "./ids-host.js";
export type { SourceDef } from "./sourcedef.js";
export * as inputs from "./inputs.js";

/**
 * Logging that tees to both the GitHub Actions console and OpenTelemetry.
 * A drop-in replacement for the `@actions/core` logging functions.
 */
export * as log from "./log.js";
export * as platform from "./platform.js";
export type { LogLevel } from "./telemetry.js";
export {
  SCOPE_NAME,
  contextFromTraceparent,
  getLogger,
  getTracer,
  recordSpanError,
  traceparentOf,
  withSpan,
} from "./telemetry.js";

/**
 * @packageDocumentation
 * Determinate Systems' TypeScript library for creating GitHub Actions logic.
 */
// import { version as pkgVersion } from "../package.json";
import * as ghActionsCorePlatform from "./actions-core-platform.js";
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
import * as semconv from "@opentelemetry/semantic-conventions";
import * as semconvIncubating from "@opentelemetry/semantic-conventions/incubating";
import { type Got, type Request, TimeoutError } from "got";
import { exec } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as nodeFs from "node:fs";
import fs, { chmod, copyFile, mkdir, readFile } from "node:fs/promises";
import os, { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

// Span events this library records itself. Names a caller passes to
// `addEvent` are used as given.
const EVENT_IDS_FAILOVER = "detsys.ids_failover";
const EVENT_PREFLIGHT_REQUIRE_NIX_DENIED =
  "detsys.preflight_require_nix_denied";
const EVENT_REQUEST_TIMEOUT = "detsys.request_timeout";
const EVENT_STORE_IDENTITY_FAILED = "detsys.store_identity_failed";

// Attributes describing the run. Where the OpenTelemetry semantic conventions
// already name a value, they win; everything else lives under `detsys.`.
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
const ATTR_GITHUB_WORKFLOW_RUN_DIFFERENTIATOR_HASH =
  "detsys.github.workflow_run_differentiator_hash";

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

// Log records, not span attributes, carry stapled files: a record's body is
// not truncated the way an attribute value is.
const ATTR_ATTACHMENT_NAME = "detsys.attachment.name";
const ATTR_ATTACHMENT_PATH = "detsys.attachment.path";

const STATE_KEY_EXECUTION_PHASE = "detsys_action_execution_phase";
const STATE_KEY_NIX_NOT_FOUND = "detsys_action_nix_not_found";
const STATE_NOT_FOUND = "not-found";
const STATE_KEY_CROSS_PHASE_ID = "detsys_cross_phase_id";
const STATE_KEY_TRACEPARENT = "detsys_otel_traceparent";
const STATE_KEY_JOB_TRACEPARENT = "detsys_otel_job_traceparent";
const STATE_KEY_JOB_SPAN_START = "detsys_otel_job_span_start";

// The standard variable that carries the trace context between programs.
// Every step of the job reads it, and so does each program the steps run.
const ENV_TRACEPARENT = "TRACEPARENT";

// The span that covers the whole workflow job, and thus every Action in it.
const SPAN_JOB = "github_actions_job";

// The check-in, which happens before this Action can record anything.
const SPAN_CHECK_IN = "check_in";

const CHECK_IN_ENDPOINT_TIMEOUT_MS = 1_000; // 1 second in ms

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

  // The URL suffix of the diagnostics endpoint this project's own binaries
  // report to. This library does not report there: its telemetry is
  // OpenTelemetry, and this only supplies `getDiagnosticsUrl()` for the
  // programs an Action runs.
  //
  // The final URL is constructed via IDS_HOST/idsProjectName/diagnosticsSuffix.
  //
  // Default: `diagnostics`.
  diagnosticsSuffix?: string;
};

/**
 * A confident version of Options, where defaults have been resolved into final values.
 */
export type ConfidentActionOptions = {
  name: string;
  idsProjectName: string;
  fetchStyle: FetchSuffixStyle;
  legacySourcePrefix?: string;
  requireNix: NixRequirementHandling;
  providedDiagnosticsUrl?: URL;
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
  private identity: correlation.CorrelationProperties;
  private idsHost: IdsHost;
  private features: { [k: string]: Feature };
  private featureVariants: { [k: string]: string | boolean };
  private telemetry: otel.Telemetry;

  // The name and version of the runner's operating system, in flight from the
  // moment the Action is constructed so that it is ready by the time the
  // resource attributes are assembled.
  private systemDetails: Promise<{ name: string; version: string } | undefined>;

  // The root span for this execution phase. Undefined until the phase span is
  // opened, and when OpenTelemetry export is disabled.
  private phaseSpan?: otelApi.Span;

  // The identity of the phase's span, and of its parent, which this Action
  // announces before either span can start.
  private phaseTraceparent?: string;
  private phaseParentTraceparent?: string;

  // When the check-in ran, and under which identity, for the span that starts
  // once the SDK does.
  private checkInTiming?: {
    traceparent: string;
    startTime: Date;
    endTime: Date;
  };

  // Attributes set before the phase span exists, replayed onto it when it
  // opens.
  private pendingAttributes: otelApi.Attributes;

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
    this.featureVariants = {};
    this.pendingAttributes = {};

    this.getCrossPhaseId();

    this.identity = correlation.identify();
    this.archOs = platform.getArchOs();
    this.nixSystem = platform.getNixPlatform(this.archOs);

    this.systemDetails = ghActionsCorePlatform
      .getDetails()
      // eslint-disable-next-line github/no-then
      .then((details) => ({ name: details.name, version: details.version }))
      // eslint-disable-next-line github/no-then
      .catch((e: unknown) => {
        actionsCore.debug(
          `Failure getting platform details: ${stringifyError(e)}`,
        );
        return undefined;
      });

    this.executionPhase = this.determineExecutionPhase();

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
  setAttribute(key: string, value: otelApi.AttributeValue): void {
    if (this.phaseSpan === undefined) {
      this.pendingAttributes[key] = value;
    } else {
      this.phaseSpan.setAttribute(key, value);
    }
  }

  /**
   * The diagnostics endpoint for the programs this Action runs, such as
   * `nix-installer` and `magic-nix-cache`.
   *
   * This library reports nothing there. Its own telemetry is OpenTelemetry;
   * see {@link getTelemetryEnvironment} for putting a child process's
   * telemetry in this run's trace.
   */
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

  /**
   * Record that something happened, as a span event.
   *
   * The event lands on whichever span is active, so that it sits on the
   * operation that produced it, and on the phase's root span when there is no
   * nested span in progress.
   *
   * Namespace your attribute keys, as OpenTelemetry expects.
   */
  addEvent(name: string, attributes?: otelApi.Attributes): void {
    const span = otelApi.trace.getActiveSpan() ?? this.phaseSpan;
    span?.addEvent(name, attributes);
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
    // The phase span opens only after the check-in.
    // The check-in supplies the feature flags for the resource attributes.
    // Thus record the true start time here and backdate the span to it.
    const phaseStartTime = new Date();

    try {
      // The announcements come first.
      // The check-in runs before this Action can record anything, and these
      // give it, and the servers that answer it, a place in the trace.
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
          this.addEvent(EVENT_STORE_IDENTITY_FAILED, {
            [semconv.ATTR_EXCEPTION_MESSAGE]: stringifyError(error),
          });
        }

        if (!(await this.preflightRequireNix())) {
          this.addEvent(EVENT_PREFLIGHT_REQUIRE_NIX_DENIED);
          return;
        } else {
          await this.preflightNixStoreInfo();
          await this.preflightNixVersion();
          this.setAttribute(ATTR_NIX_STORE_TRUST, this.nixStoreTrust);
        }

        if (this.isMain) {
          await this.main();

          // Run the preflight of the nix version a second time so our final
          // telemetry has updated version info.
          await this.preflightNixVersion();
        } else if (this.isPost) {
          await this.post();
        }
      });
    } catch (e: unknown) {
      const reportable = stringifyError(e);

      // The span's status and its `exception` event say the phase failed.
      if (this.phaseSpan !== undefined) {
        otel.recordSpanError(this.phaseSpan, e);
      }

      if (this.isPost) {
        log.warning(reportable);
      } else {
        log.setFailed(reportable);
      }

      await this.withPhaseSpanActive(async () => {
        await this.emitAttachments();
      });
    } finally {
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
  private async startTelemetry(): Promise<void> {
    this.telemetry.start({
      // The `-action` suffix says this service is the Action, not the tool it runs.
      serviceName: `${this.actionOptions.name}-action`,
      // The Action's own version, which is the ref the workflow pinned.
      serviceVersion: process.env["GITHUB_ACTION_REF"],
      resourceAttributes: await this.telemetryResourceAttributes(),
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
  private announceJobTrace(startTime: Date): void {
    if (!this.isMain || !otel.exportEnabled()) {
      return;
    }

    if (process.env[ENV_TRACEPARENT]) {
      return;
    }

    const traceparent = otel.newTraceparent();

    // `exportVariable` sets the variable in this process, and in each
    // subsequent step of the job.
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
  private endJobSpan(): void {
    if (!this.isPost) {
      return;
    }

    const traceparent = actionsCore.getState(STATE_KEY_JOB_TRACEPARENT);
    if (traceparent === "") {
      return;
    }

    const startTime = parseInt(
      actionsCore.getState(STATE_KEY_JOB_SPAN_START),
      10,
    );

    this.telemetry
      .startAnnouncedSpan(
        SPAN_JOB,
        traceparent,
        new Date(Number.isFinite(startTime) ? startTime : Date.now()),
      )
      ?.end();
  }

  /**
   * Make the identity of a span that starts later, and point each request made
   * until then at it.
   *
   * The variable changes in this process only.
   * The later steps of the job keep the identity of the job's span.
   */
  private announceSpan(parent: string | undefined): string | undefined {
    if (!otel.exportEnabled()) {
      return undefined;
    }

    const traceparent = otel.newTraceparent(parent);
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
  private announcePhaseSpan(): void {
    this.phaseParentTraceparent =
      actionsCore.getState(STATE_KEY_TRACEPARENT) ||
      process.env[ENV_TRACEPARENT] ||
      undefined;

    this.phaseTraceparent = this.announceSpan(this.phaseParentTraceparent);
  }

  /**
   * Start the root span of this execution phase, with the identity that {@link
   * announcePhaseSpan} announced.
   *
   * The span starts at the moment the phase did, and thus covers the check-in
   * and the start of the SDK, which both come before it.
   */
  private startPhaseSpan(startTime: Date): void {
    if (this.phaseTraceparent === undefined) {
      return;
    }

    const span = this.telemetry.startAnnouncedSpan(
      `${this.actionOptions.name}:${this.executionPhase}`,
      this.phaseTraceparent,
      startTime,
      otel.contextFromTraceparent(this.phaseParentTraceparent),
    );

    if (span === undefined) {
      return;
    }

    span.setAttributes(this.pendingAttributes);
    this.pendingAttributes = {};

    if (this.isMain) {
      const traceparent = otel.traceparentOf(span);
      if (traceparent !== undefined) {
        actionsCore.saveState(STATE_KEY_TRACEPARENT, traceparent);
      }
    }

    this.phaseSpan = span;
  }

  /**
   * Start and end the span for the check-in, which ran before the SDK could
   * record it.
   */
  private startCheckInSpan(): void {
    const timing = this.checkInTiming;

    if (timing === undefined || this.phaseSpan === undefined) {
      return;
    }

    this.telemetry
      .startAnnouncedSpan(
        SPAN_CHECK_IN,
        timing.traceparent,
        timing.startTime,
        otelApi.trace.setSpan(otelApi.context.active(), this.phaseSpan),
      )
      ?.end(timing.endTime);
  }

  /**
   * The stable, run-scoped attributes attached to every span and log record.
   *
   * The correlation data here is hashed and does not identify a repository,
   * an organization, or a person.
   */
  private async telemetryResourceAttributes(): Promise<otelApi.Attributes> {
    const details = await this.systemDetails;

    return {
      [semconvIncubating.ATTR_OS_TYPE]: osType(),
      [semconvIncubating.ATTR_HOST_ARCH]: hostArch(),
      ...(details?.name === undefined || details.name === "unknown"
        ? {}
        : { [semconvIncubating.ATTR_OS_NAME]: details.name }),
      ...(details?.version === undefined || details.version === "unknown"
        ? {}
        : { [semconvIncubating.ATTR_OS_VERSION]: details.version }),

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
      [ATTR_GITHUB_ORGANIZATION_HASH]:
        this.identity.$groups["github_organization"],
      [ATTR_GITHUB_WORKFLOW_HASH]: this.identity.github_workflow_hash,
      [ATTR_GITHUB_WORKFLOW_JOB_HASH]: this.identity.github_workflow_job_hash,
      [ATTR_GITHUB_WORKFLOW_RUN_HASH]: this.identity.github_workflow_run_hash,
      [ATTR_GITHUB_WORKFLOW_RUN_DIFFERENTIATOR_HASH]:
        this.identity.github_workflow_run_differentiator_hash,

      // The feature flags this run resolved, so the data can be sliced by the
      // variants that produced it.
      ...Object.fromEntries(
        Object.entries(this.featureVariants).map<[string, string | boolean]>(
          ([name, variant]) => [`${ATTR_FEATURE_PREFIX}${name}`, variant],
        ),
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
  async getTelemetryEnvironment(): Promise<Record<string, string>> {
    if (!this.telemetry.enabled) {
      return {};
    }

    const environment: Record<string, string> = otel.otlpExportEnvironment();

    const traceparent = this.getTraceparent();
    if (traceparent !== undefined) {
      environment["TRACEPARENT"] = traceparent;
    }

    return environment;
  }

  async getClient(): Promise<Got> {
    return await this.idsHost.getGot(
      (incitingError: unknown, prevUrl: URL, nextUrl: URL) => {
        this.recordPlausibleTimeout(incitingError);

        this.addEvent(EVENT_IDS_FAILOVER, {
          "detsys.ids.previous_url": prevUrl.toString(),
          "detsys.ids.next_url": nextUrl.toString(),
        });
      },
    );
  }

  private async checkIn(): Promise<void> {
    // The span for this starts once the SDK does. Until then the announcement
    // is what puts the check-in, and the work the server does for it, inside
    // this phase.
    const traceparent = this.announceSpan(this.phaseTraceparent);
    const startTime = new Date();

    try {
      await this.checkInAndReport();
    } finally {
      if (traceparent !== undefined) {
        this.checkInTiming = { traceparent, startTime, endTime: new Date() };
      }

      // Each request from here on is part of the phase itself.
      if (this.phaseTraceparent !== undefined) {
        process.env[ENV_TRACEPARENT] = this.phaseTraceparent;
      }
    }
  }

  /**
   * Check in, and tell the user about the incidents and the maintenance the
   * check-in reports.
   */
  private async checkInAndReport(): Promise<void> {
    const checkin = await this.requestCheckIn();
    if (checkin === undefined) {
      return;
    }

    this.features = checkin.options;
    for (const [key, feature] of Object.entries(this.features)) {
      this.featureVariants[key] = feature.variant;
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

  /**
   * The variant of a feature flag this run resolved, if the check-in returned
   * one.
   *
   * Every resolved variant is already a resource attribute, under
   * `detsys.feature.`, so the telemetry can be sliced by the flags that
   * produced it.
   */
  getFeature(name: string): Feature | undefined {
    if (!this.features.hasOwnProperty(name)) {
      return undefined;
    }

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
  private async checkInPersonProperties(): Promise<Record<string, unknown>> {
    /* eslint-disable camelcase */
    const properties: Record<string, string | boolean | number> = {
      ci: "github",
      $lib: "idslib",
      $lib_version: otel.LIBRARY_VERSION,
      $app_name: `${this.actionOptions.name}/action`,
      project: this.actionOptions.name,
      ids_project: this.actionOptions.idsProjectName,
      arch_os: this.archOs,
      nix_system: this.nixSystem,
      execution_phase: this.executionPhase,
    };

    const fromEnvironment = [
      ["github_action_ref", "GITHUB_ACTION_REF"],
      ["github_action_repository", "GITHUB_ACTION_REPOSITORY"],
      ["github_event_name", "GITHUB_EVENT_NAME"],
      ["$os", "RUNNER_OS"],
      ["arch", "RUNNER_ARCH"],
    ];
    for (const [target, variable] of fromEnvironment) {
      const value = process.env[variable];
      if (value) {
        properties[target] = value;
      }
    }

    const details = await this.systemDetails;
    if (details !== undefined) {
      if (details.name !== "unknown") {
        properties.$os = details.name;
      }
      if (details.version !== "unknown") {
        properties.$os_version = details.version;
      }
    }
    /* eslint-enable camelcase */

    return { ...properties, ...this.identity };
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

        /* eslint-disable camelcase */
        const props = {
          // Use a distinct_id when we actually have one
          distinct_id: this.identity.$anon_distinct_id,
          anon_distinct_id: this.identity.$anon_distinct_id,
          groups: this.identity.$groups,
          person_properties: await this.checkInPersonProperties(),
        };
        /* eslint-enable camelcase */

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
      const attributes: otelApi.Attributes = {
        [semconv.ATTR_URL_FULL]: e.request.requestUrl?.toString(),
        [semconv.ATTR_HTTP_REQUEST_RESEND_COUNT]: e.request.retryCount,
      };

      for (const [key, value] of Object.entries(e.timings.phases)) {
        if (Number.isFinite(value)) {
          attributes[`detsys.http.timing.${key}`] = value;
        }
      }

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
  private async fetchArtifact(): Promise<string> {
    const sourceBinary = inputs.getStringOrNull("source-binary");

    // If source-binary is set, use that. Otherwise fall back to the source-* parameters.
    if (sourceBinary !== null && sourceBinary !== "") {
      log.debug(`Using the provided source binary at ${sourceBinary}`);
      return sourceBinary;
    }

    return await otel.withSpan(
      "fetch_artifact",
      async (span) => {
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
            this.setAttribute(ATTR_SOURCE_ETAG, v);

            log.debug(
              `Checking the tool cache for ${await this.getSourceUrl()} at ${v}`,
            );
            const cached = await this.getCachedVersion(v, expectedArtifactHash);
            if (cached) {
              span.setAttribute(ATTR_ARTIFACT_CACHE_HIT, true);
              log.debug(`Tool cache hit.`);
              await this.verifyArtifactHash(cached, expectedArtifactHash);
              return cached;
            }
          }

          span.setAttribute(ATTR_ARTIFACT_CACHE_HIT, false);

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
        [ATTR_ARTIFACT_NAME]: this.actionOptions.name,
        [ATTR_ARTIFACT_FETCH_SUFFIX]: this.architectureFetchSuffix,
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
    this.setAttribute(ATTR_SOURCE_CHECKSUMS_SHA256, expectedFileHash);

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
    this.phaseSpan?.end();
    this.phaseSpan = undefined;

    // The job's span contains this phase, so it ends after this phase does.
    this.endJobSpan();

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
      this.setAttribute(ATTR_SOURCE_URL, p.url);
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

    this.setAttribute(ATTR_SOURCE_URL, fetchUrl.toString());

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
          span.setAttribute(ATTR_ARTIFACT_CACHE_HIT, true);
          return `${tempDir}/${this.actionOptions.name}`;
        }

        span.setAttribute(ATTR_ARTIFACT_CACHE_HIT, false);
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
      } finally {
        process.env.GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE_BACKUP;
        delete process.env.GITHUB_WORKSPACE_BACKUP;
        process.chdir(startCwd);
      }
    });
  }

  /**
   * Emit the files `stapleFile` collected, as log records correlated to this
   * phase's span. The Action has already failed by the time this runs.
   */
  private async emitAttachments(): Promise<void> {
    for (const [name, location] of this.exceptionAttachments) {
      const attributes: otelApi.Attributes = {
        [ATTR_ATTACHMENT_NAME]: name,
        [ATTR_ATTACHMENT_PATH]: location.toString(),
      };

      try {
        otel.emitLogRecord(
          "error",
          await readFile(location, "utf-8"),
          attributes,
        );
      } catch (innerError: unknown) {
        otel.emitLogRecord("error", `Attachment unavailable`, {
          ...attributes,
          [semconv.ATTR_EXCEPTION_MESSAGE]: stringifyError(innerError),
        });
      }
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
      this.setAttribute(ATTR_NIX_LOCATION, nixLocation || "");

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
        this.setAttribute(ATTR_NIX_STORE_CHECK_METHOD, "info");
      } catch {
        try {
          // reset output
          output = "";
          await actionsExec.exec("nix", ["store", "ping", "--json"], options);
          this.setAttribute(ATTR_NIX_STORE_CHECK_METHOD, "ping");
        } catch {
          this.setAttribute(ATTR_NIX_STORE_CHECK_METHOD, "none");
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
          this.setAttribute(
            ATTR_NIX_STORE_CHECK_ERROR,
            `Mysterious trusted value: ${JSON.stringify(parsed.trusted)}`,
          );
        }

        this.setAttribute(
          ATTR_NIX_STORE_VERSION,
          JSON.stringify(parsed.version),
        );
      } catch (e: unknown) {
        this.setAttribute(ATTR_NIX_STORE_CHECK_ERROR, stringifyError(e));
      }

      span.setAttribute(ATTR_NIX_STORE_TRUST, this.nixStoreTrust);
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

      this.setAttribute(ATTR_NIX_VERSION, output);
      span.setAttribute(ATTR_NIX_VERSION, output);
    });
  }
}

function stringifyError(error: unknown): string {
  return error instanceof Error || typeof error == "string"
    ? error.toString()
    : JSON.stringify(error);
}

/**
 * The runner's operating system, as `os.type` spells it.
 */
function osType(): string {
  switch (ghActionsCorePlatform.platform) {
    case "win32":
      return semconvIncubating.OS_TYPE_VALUE_WINDOWS;
    case "darwin":
      return semconvIncubating.OS_TYPE_VALUE_DARWIN;
    case "linux":
      return semconvIncubating.OS_TYPE_VALUE_LINUX;
    default:
      return ghActionsCorePlatform.platform;
  }
}

/**
 * The runner's architecture, as `host.arch` spells it.
 */
function hostArch(): string {
  switch (ghActionsCorePlatform.arch) {
    case "x64":
      return semconvIncubating.HOST_ARCH_VALUE_AMD64;
    case "arm64":
      return semconvIncubating.HOST_ARCH_VALUE_ARM64;
    case "ia32":
      return semconvIncubating.HOST_ARCH_VALUE_X86;
    case "arm":
      return semconvIncubating.HOST_ARCH_VALUE_ARM32;
    default:
      return ghActionsCorePlatform.arch;
  }
}

function makeOptionsConfident(
  actionOptions: ActionOptions,
): ConfidentActionOptions {
  const idsProjectName = actionOptions.idsProjectName ?? actionOptions.name;

  const finalOpts: ConfidentActionOptions = {
    name: actionOptions.name,
    idsProjectName,
    fetchStyle: actionOptions.fetchStyle,
    legacySourcePrefix: actionOptions.legacySourcePrefix,
    requireNix: actionOptions.requireNix,
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
  traceContextHeaders,
  traceparentOf,
  withSpan,
} from "./telemetry.js";

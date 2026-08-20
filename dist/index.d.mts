import * as actionsCore from "@actions/core";
import { UUID } from "node:crypto";
import { Got } from "got";
import * as otelApi from "@opentelemetry/api";
import { Attributes } from "@opentelemetry/api";
import { Logger } from "@opentelemetry/api-logs";
//#region src/check-in.d.ts
type CheckIn = {
  status: StatusSummary | null;
  options: {
    [k: string]: Feature;
  };
};
type StatusSummary = {
  page: Page;
  incidents: Incident[];
  scheduled_maintenances: Maintenance[];
};
type Page = {
  name: string;
  url: string;
};
type Incident = {
  name: string;
  status: string;
  impact: string;
  shortlink: string;
};
type Maintenance = {
  name: string;
  status: string;
  impact: string;
  shortlink: string;
  scheduled_for: string;
  scheduled_until: string;
};
type Feature = {
  variant: boolean | string;
  payload?: string;
};
//#endregion
//#region src/correlation.d.ts
/**
 * JSON sent to server.
 */
type CorrelationProperties = {
  $anon_distinct_id: string;
  $groups: Record<string, string | undefined>;
  $session_id?: string;
  correlation_source: string;
  github_repository_hash?: string;
  github_workflow_hash?: string;
  github_workflow_job_hash?: string;
  github_workflow_run_differentiator_hash?: string;
  github_workflow_run_hash?: string;
  is_ci: boolean;
};
//#endregion
//#region src/errors.d.ts
/**
 * Coerce a value of type `unknown` into a string.
 */
declare function stringifyError(e: unknown): string;
//#endregion
//#region src/ids-host.d.ts
/**
 * Host information for install.determinate.systems.
 */
declare class IdsHost {
  private idsProjectName;
  private diagnosticsSuffix?;
  private runtimeDiagnosticsUrl?;
  private prioritizedURLs?;
  private client?;
  private timeout;
  constructor(idsProjectName: string, diagnosticsSuffix: string | undefined, runtimeDiagnosticsUrl: string | undefined, timeout?: number);
  getGot(recordFailoverCallback?: (incitingError: unknown, prevUrl: URL, nextUrl: URL) => void): Promise<Got>;
  markCurrentHostBroken(): void;
  setPrioritizedUrls(urls: URL[]): void;
  isUrlSubjectToDynamicUrls(url: URL): boolean;
  getDynamicRootUrl(): Promise<URL | undefined>;
  getRootUrl(): Promise<URL>;
  getDiagnosticsUrl(): Promise<URL | undefined>;
  private getUrlsByPreference;
}
//#endregion
//#region src/sourcedef.d.ts
type SourceDef = {
  path?: string;
  url?: string;
  tag?: string;
  pr?: string;
  branch?: string;
  revision?: string;
};
declare namespace inputs_d_exports {
  export { Separator, getArrayOfStrings, getArrayOfStringsOrNull, getBool, getBoolOrUndefined, getMultilineStringOrNull, getNumberOrNull, getNumberOrUndefined, getString, getStringOrNull, getStringOrUndefined, handleString };
}
/**
 * Get a Boolean input from the Action's configuration by name.
 */
declare const getBool: (name: string) => boolean;
/**
 * Get a Boolean input from the Action's configuration by name, or undefined if it is unset.
 */
declare const getBoolOrUndefined: (name: string) => boolean | undefined;
/**
 * The character used to separate values in the input string.
 */
type Separator = "space" | "comma";
/**
 * Convert a comma-separated string input into an array of strings. If `comma` is selected,
 * all whitespace is removed from the string before converting to an array.
 */
declare const getArrayOfStrings: (name: string, separator: Separator) => string[];
/**
 * Convert a string input into an array of strings or `null` if no value is set.
 */
declare const getArrayOfStringsOrNull: (name: string, separator: Separator) => string[] | null;
declare const handleString: (input: string, separator: Separator) => string[];
/**
 * Get a multi-line string input from the Action's configuration by name or return `null` if not set.
 */
declare const getMultilineStringOrNull: (name: string) => string[] | null;
/**
 * Get a number input from the Action's configuration by name or return `null` if not set.
 */
declare const getNumberOrNull: (name: string) => number | null;
/**
 * Get a Number input from the Action's configuration by name, or undefined if it is unset.
 */
declare const getNumberOrUndefined: (name: string) => number | undefined;
/**
 * Get a string input from the Action's configuration.
 */
declare const getString: (name: string) => string;
/**
 * Get a string input from the Action's configuration by name or return `null` if not set.
 */
declare const getStringOrNull: (name: string) => string | null;
/**
 * Get a string input from the Action's configuration by name or return `undefined` if not set.
 */
declare const getStringOrUndefined: (name: string) => string | undefined;
declare namespace log_d_exports {
  export { debug, error, group, info, notice, setFailed, warning };
}
/**
 * `@actions/core` accepts an Error in place of a message for the annotation
 * functions, and renders it via `toString()`.
 */
type Message = string | Error;
/**
 * Write a debug message. Only visible in the workflow log when the user has
 * enabled step debug logging, but always exported to OpenTelemetry.
 */
declare function debug(message: string, attributes?: Attributes): void;
/** Write an informational message to the workflow log. */
declare function info(message: string, attributes?: Attributes): void;
/** Write a notice annotation to the workflow log. */
declare function notice(message: Message, properties?: actionsCore.AnnotationProperties, attributes?: Attributes): void;
/** Write a warning annotation to the workflow log. */
declare function warning(message: Message, properties?: actionsCore.AnnotationProperties, attributes?: Attributes): void;
/** Write an error annotation to the workflow log. */
declare function error(message: Message, properties?: actionsCore.AnnotationProperties, attributes?: Attributes): void;
/**
 * Fail the workflow step, recording the reason as an OpenTelemetry error log.
 */
declare function setFailed(message: Message, attributes?: Attributes): void;
/**
 * Run `fn` inside both a collapsible group in the workflow log and an active
 * OpenTelemetry span of the same name.
 *
 * This is the replacement for a `startGroup`/`endGroup` pair: the group closes
 * and the span ends even if `fn` throws, and a throwing `fn` marks the span
 * failed before re-throwing.
 */
declare function group<T>(name: string, fn: () => Promise<T>, attributes?: Attributes): Promise<T>;
declare namespace platform_d_exports {
  export { getArchOs, getNixPlatform };
}
/**
 * Get the current architecture plus OS. Examples include `X64-Linux` and `ARM64-macOS`.
 */
declare function getArchOs(): string;
/**
 * Get the current Nix system. Examples include `x86_64-linux` and `aarch64-darwin`.
 */
declare function getNixPlatform(archOs: string): string;
//#endregion
//#region src/telemetry.d.ts
/** The instrumentation scope name for everything this library emits. */
declare const SCOPE_NAME = "detsys-ts";
/** The severities we map GitHub Actions' log levels onto. */
type LogLevel = "debug" | "info" | "notice" | "warning" | "error";
/**
 * The tracer for this library. Returns a no-op tracer until {@link
 * Telemetry.start} has run, so this is always safe to call.
 */
declare function getTracer(): otelApi.Tracer;
/**
 * The logger for this library. Returns a no-op logger until {@link
 * Telemetry.start} has run, so this is always safe to call.
 */
declare function getLogger(): Logger;
/**
 * Serialize a span as a W3C `traceparent` header value, suitable for stashing
 * in the Action's state or handing to a child process.
 *
 * Returns undefined when telemetry is disabled, since the no-op span's context
 * is all zeroes and would not be a valid parent.
 */
declare function traceparentOf(span: otelApi.Span | undefined): string | undefined;
/**
 * Rebuild a Context from a W3C `traceparent` value, so a span started in one
 * process can parent spans started in another. Falls back to the root context
 * when `traceparent` is absent or unparseable.
 */
declare function contextFromTraceparent(traceparent: string | undefined): otelApi.Context;
/**
 * Mark `span` as failed and attach the exception to it.
 */
declare function recordSpanError(span: otelApi.Span, error: unknown): void;
/**
 * Run `fn` inside a new active span, ending the span when it settles and
 * marking it failed if it throws. The error is always re-thrown: this records,
 * it does not swallow.
 */
declare function withSpan<T>(name: string, fn: (span: otelApi.Span) => Promise<T>, attributes?: otelApi.Attributes): Promise<T>;
//#endregion
//#region src/index.d.ts
/**
 * An enum for describing different "fetch suffixes" for i.d.s.
 *
 * - `nix-style` means that system names like `x86_64-linux` and `aarch64-darwin` are used
 * - `gh-env-style` means that names like `X64-Linux` and `ARM64-macOS` are used
 * - `universal` means that the suffix is the static `universal` (for non-system-specific things)
 */
type FetchSuffixStyle = "nix-style" | "gh-env-style" | "universal";
/**
 * GitHub Actions has two possible execution phases: `main` and `post`.
 */
type ExecutionPhase = "main" | "post";
/**
 * How to handle whether Nix is currently installed on the runner.
 *
 * - `fail` means that the workflow fails if Nix isn't installed
 * - `warn` means that a warning is logged if Nix isn't installed
 * - `ignore` means that Nix will not be checked
 */
type NixRequirementHandling = "fail" | "warn" | "ignore";
/**
 * Whether the Nix store on the runner is trusted.
 *
 * - `trusted` means yes
 * - `untrusted` means no
 * - `unknown` means that the status couldn't be determined
 *
 * This is determined via the output of `nix store info --json`.
 */
type NixStoreTrust = "trusted" | "untrusted" | "unknown";
type ActionOptions = {
  name: string;
  idsProjectName?: string;
  eventPrefix?: string;
  fetchStyle: FetchSuffixStyle;
  legacySourcePrefix?: string;
  requireNix: NixRequirementHandling;
  diagnosticsSuffix?: string;
  binaryNamePrefixes?: string[];
  binaryNamesDenyList?: string[];
};
/**
 * A confident version of Options, where defaults have been resolved into final values.
 */
type ConfidentActionOptions = {
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
type EventContext = Record<string, boolean | string | number | undefined | Record<string, boolean | string | number | undefined>>;
/**
 * An event to send to the diagnostic endpoint of i.d.s.
 */
type DiagnosticEvent = {
  name: string;
  distinct_id?: string;
  uuid: UUID;
  timestamp: Date;
  properties: Record<string, unknown>;
};
declare abstract class DetSysAction {
  nixStoreTrust: NixStoreTrust;
  strictMode: boolean;
  private actionOptions;
  private exceptionAttachments;
  private archOs;
  private executionPhase;
  private nixSystem;
  private architectureFetchSuffix;
  private sourceParameters;
  private facts;
  private events;
  private identity;
  private idsHost;
  private features;
  private featureEventMetadata;
  private telemetry;
  private phaseSpan?;
  private determineExecutionPhase;
  constructor(actionOptions: ActionOptions);
  /**
   * Attach a file to the diagnostics data in error conditions.
   *
   * The file at `location` doesn't need to exist when stapleFile is called.
   *
   * If the file doesn't exist or is unreadable when trying to staple the attachments, the JS error will be stored in a context value at `staple_failure_{name}`.
   * If the file is readable, the file's contents will be stored in a context value at `staple_value_{name}`.
   */
  stapleFile(name: string, location: string): void;
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
  execute(): void;
  getTemporaryName(): string;
  addFact(key: string, value: string | boolean | number): void;
  getDiagnosticsUrl(): Promise<URL | undefined>;
  getUniqueId(): string;
  getCrossPhaseId(): string;
  getCorrelationHashes(): CorrelationProperties;
  recordEvent(eventName: string, context?: EventContext): void;
  /**
   * Unpacks the closure returned by `fetchArtifact()`, imports the
   * contents into the Nix store, and returns the path of the executable at
   * `/nix/store/STORE_PATH/bin/${bin}`.
   */
  unpackClosure(bin: string): Promise<string>;
  /**
   * Fetches the executable at the URL determined by the `source-*` inputs and
   * other facts, `chmod`s it, and returns the path to the executable on disk.
   */
  fetchExecutable(): Promise<string>;
  private get isMain();
  private get isPost();
  private executeAsync;
  /**
   * Run `fn` with the phase's root span as the active span, so anything it
   * starts is parented into this phase's trace.
   */
  private withPhaseSpanActive;
  /**
   * Start the OpenTelemetry export.
   *
   * All runs export their data.
   * To stop the export, set `OTEL_EXPORTER_OTLP_ENDPOINT` to an empty value.
   * The function then finds no endpoint and does not start the SDK.
   * The OpenTelemetry API stays in its no-op state.
   * Each span and log record then does nothing.
   * Thus the call sites do not test if the export is on.
   *
   * This function runs after the check-in.
   * The check-in supplies the feature flags for the resource attributes.
   */
  private startTelemetry;
  /**
   * Open the root span for this execution phase.
   *
   * `main` and `post` are separate processes, so the main phase publishes its
   * span as a W3C traceparent in the Action's state and the post phase adopts
   * it as a parent. That puts both phases of a run in one trace.
   */
  private startPhaseSpan;
  /**
   * The stable, run-scoped attributes attached to every span and log record.
   *
   * These carry the same hashed, non-identifying correlation data the
   * diagnostics endpoint already receives.
   */
  private telemetryResourceAttributes;
  /**
   * The W3C `traceparent` identifying the span currently in progress.
   *
   * Hand this to a child process -- as `$TRACEPARENT` -- so that its own
   * OpenTelemetry data joins this Action's trace. Returns undefined when
   * OpenTelemetry export is disabled for this run.
   */
  getTraceparent(): string | undefined;
  /**
   * The environment variables that let a child process add data to this
   * Action's trace.
   * They contain the current `$TRACEPARENT`, the OTLP endpoint, and the token.
   *
   * Add these variables to the environment of each child process to trace.
   * The result is empty if the OpenTelemetry export is off.
   * Thus it is always safe to add them.
   */
  getTelemetryEnvironment(): Promise<Record<string, string>>;
  getClient(): Promise<Got>;
  private checkIn;
  getFeature(name: string): Feature | undefined;
  private recordGroup;
  /**
   * Check in to install.determinate.systems, to accomplish three things:
   *
   * 1. Preflight the server selected from IdsHost, to increase the chances of success.
   * 2. Fetch any incidents and maintenance events to let users know in case things are weird.
   * 3. Get feature flag data so we can gently roll out new features.
   */
  private requestCheckIn;
  private recordPlausibleTimeout;
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
  private fetchArtifact;
  /**
   * Read the `source-checksums-url` and `source-checksums-sha256` inputs and,
   * if both are set, fetch the checksums file, verify its hash matches the
   * pin, parse it, and return the expected hash for the artifact matching
   * this runner's `${name}-${architectureFetchSuffix}`. Returns `null` when
   * verification is opted out (both inputs unset).
   */
  private resolveExpectedArtifactHash;
  /**
   * Verify a downloaded artifact's SHA-256 matches the expected hash. No-op
   * when `expected` is `null` (verification disabled).
   */
  private verifyArtifactHash;
  /**
   * A helper function for failing on error only if strict mode is enabled.
   * This is intended only for CI environments testing Actions themselves.
   */
  failOnError(msg: string): void;
  private downloadFile;
  private download;
  private complete;
  private getCheckInUrl;
  private getSourceUrl;
  private cacheKey;
  private getCachedVersion;
  private saveCachedVersion;
  private collectBacktraceSetup;
  private collectBacktraces;
  private preflightRequireNix;
  private preflightNixStoreInfo;
  private preflightNixVersion;
  private submitEvents;
}
//#endregion
export { ActionOptions, type CheckIn, ConfidentActionOptions, type CorrelationProperties, DetSysAction, DiagnosticEvent, EventContext, ExecutionPhase, type Feature, FetchSuffixStyle, IdsHost, type Incident, type LogLevel, type Maintenance, NixRequirementHandling, NixStoreTrust, type Page, SCOPE_NAME, type SourceDef, type StatusSummary, contextFromTraceparent, getLogger, getTracer, inputs_d_exports as inputs, log_d_exports as log, platform_d_exports as platform, recordSpanError, stringifyError, traceparentOf, withSpan };
//# sourceMappingURL=index.d.mts.map
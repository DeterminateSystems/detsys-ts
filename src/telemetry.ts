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
import { stringifyError } from "./errors.js";
import * as actionsCore from "@actions/core";
import * as otelApi from "@opentelemetry/api";
import { type Logger, SeverityNumber, logs } from "@opentelemetry/api-logs";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import * as otelCore from "@opentelemetry/core";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import * as otelResources from "@opentelemetry/resources";
import * as sdkLogs from "@opentelemetry/sdk-logs";
import * as sdkTrace from "@opentelemetry/sdk-trace-base";
import * as semconv from "@opentelemetry/semantic-conventions";

/** The instrumentation scope name for everything this library emits. */
export const SCOPE_NAME = "detsys-ts";

/** The version reported as the instrumentation scope's version. */
export const LIBRARY_VERSION = "1.0";

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
const OTLP_INGEST_TOKEN =
  "8bfa2d8b689352981286f0149c4e55cc0dff30a4f7a735b560e31479904a74e1";

/**
 * How long to wait for buffered spans and logs to reach the collector before
 * giving up. The Action's process exits immediately afterward, so this is a
 * hard ceiling on how much a slow collector can delay a workflow.
 */
const SHUTDOWN_TIMEOUT_MS = 5_000;

/**
 * The default for `OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT`.
 *
 * The SDK's own default is unlimited. Attributes here can carry pasted
 * command output and other unbounded text, which the collector should not
 * have to absorb, so cap them. File-sized payloads go out as log records
 * instead: a log record's body is not an attribute and is not truncated.
 */
const DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT = 8_192;

/** The OTLP environment variables a child process inherits from this run. */
const OTLP_EXPORT_VARIABLES = [
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "OTEL_EXPORTER_OTLP_HEADERS",
  "OTEL_EXPORTER_OTLP_COMPRESSION",
] as const;

/**
 * Our own propagator instance, rather than the global one.
 *
 * The global propagator only exists once {@link Telemetry.start} has
 * registered it, which would make traceparent handling silently depend on
 * start-up ordering. Owning an instance keeps {@link traceparentOf} and {@link
 * contextFromTraceparent} correct no matter when they're called.
 */
const PROPAGATOR = new otelCore.W3CTraceContextPropagator();

/** The severities we map GitHub Actions' log levels onto. */
export type LogLevel = "debug" | "info" | "notice" | "warning" | "error";

const SEVERITY: Record<LogLevel, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  notice: SeverityNumber.INFO2,
  warning: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

export type TelemetryOptions = {
  /** The `service.name` for this run, unless `OTEL_SERVICE_NAME` overrides it. */
  serviceName: string;

  /** The `service.version` for this run, when it is known. */
  serviceVersion?: string;

  /** Resource attributes for this run, added to each span and log record. */
  resourceAttributes: otelApi.Attributes;
};

/**
 * Whether this run exports telemetry at all.
 *
 * `OTEL_SDK_DISABLED=true` is the standard way to turn the export off. An
 * empty `OTEL_EXPORTER_OTLP_ENDPOINT` does the same, which is what this
 * library documented before `OTEL_SDK_DISABLED` was in the specification.
 */
export function exportEnabled(): boolean {
  if (otelCore.getBooleanFromEnv("OTEL_SDK_DISABLED")) {
    return false;
  }

  const endpoint = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];
  if (endpoint !== undefined && endpoint.trim() === "") {
    return false;
  }

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
export function applyOtlpEnvironmentDefaults(): void {
  if (otelCore.getStringFromEnv("OTEL_EXPORTER_OTLP_ENDPOINT") === undefined) {
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = DEFAULT_OTLP_ENDPOINT;
  }

  if (exportsToDefaultCollector()) {
    // The collector refuses data that carries no token. Leave a token the
    // user supplied alone: theirs is the one they meant to use.
    const headers = otelCore.parseKeyPairsIntoRecord(
      otelCore.getStringFromEnv("OTEL_EXPORTER_OTLP_HEADERS"),
    );

    const authorized = Object.keys(headers).some(
      (name) => name.toLowerCase() === "authorization",
    );

    if (!authorized) {
      headers["Authorization"] = `Bearer ${OTLP_INGEST_TOKEN}`;
      process.env["OTEL_EXPORTER_OTLP_HEADERS"] = encodeOtlpHeaders(headers);
    }
  }

  if (
    otelCore.getStringFromEnv("OTEL_EXPORTER_OTLP_COMPRESSION") === undefined
  ) {
    // Crash reports and installer logs go out as log records, so the bodies
    // are large and highly compressible.
    process.env["OTEL_EXPORTER_OTLP_COMPRESSION"] = "gzip";
  }

  if (
    otelCore.getNumberFromEnv("OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT") === undefined
  ) {
    process.env["OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT"] =
      `${DEFAULT_ATTRIBUTE_VALUE_LENGTH_LIMIT}`;
  }
}

/**
 * Whether this run sends its data to {@link DEFAULT_OTLP_ENDPOINT}.
 *
 * Only that collector gets {@link OTLP_INGEST_TOKEN}. A collector the user
 * chose must not receive our credentials.
 */
function exportsToDefaultCollector(): boolean {
  const endpoint = otelCore.getStringFromEnv("OTEL_EXPORTER_OTLP_ENDPOINT");

  if (endpoint === undefined) {
    return false;
  }

  try {
    return (
      new URL(endpoint).toString() === new URL(DEFAULT_OTLP_ENDPOINT).toString()
    );
  } catch {
    return false;
  }
}

/**
 * The OTLP variables in the environment, for a child process that does not
 * inherit ours.
 */
export function otlpExportEnvironment(): Record<string, string> {
  const environment: Record<string, string> = {};

  for (const name of OTLP_EXPORT_VARIABLES) {
    const value = otelCore.getStringFromEnv(name);
    if (value !== undefined) {
      environment[name] = value;
    }
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
export function encodeOtlpHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(
      ([name, value]) =>
        `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    )
    .join(",");
}

/**
 * Owns the OpenTelemetry SDK's lifecycle. Constructing this does nothing on
 * its own; `start()` registers the global providers and `shutdown()` flushes
 * whatever is buffered.
 */
export class Telemetry {
  private tracerProvider?: sdkTrace.BasicTracerProvider;
  private loggerProvider?: sdkLogs.LoggerProvider;

  /** Whether OTLP export is actually running. */
  get enabled(): boolean {
    return this.tracerProvider !== undefined;
  }

  /**
   * Register the global tracer and logger providers.
   *
   * Safe to call at most once. If it throws, telemetry stays disabled and the
   * Action carries on: instrumentation degrades to the API's no-ops rather
   * than failing the workflow.
   */
  start(options: TelemetryOptions): void {
    if (this.enabled || !exportEnabled()) {
      return;
    }

    try {
      applyOtlpEnvironmentDefaults();

      // `envDetector` comes last, so `OTEL_SERVICE_NAME` and
      // `OTEL_RESOURCE_ATTRIBUTES` win over what the Action decided.
      const resource = otelResources
        .defaultResource()
        .merge(
          otelResources.resourceFromAttributes({
            [semconv.ATTR_SERVICE_NAME]: options.serviceName,
            ...(options.serviceVersion === undefined
              ? {}
              : { [semconv.ATTR_SERVICE_VERSION]: options.serviceVersion }),
            ...options.resourceAttributes,
          }),
        )
        .merge(
          otelResources.detectResources({
            detectors: [otelResources.envDetector],
          }),
        );

      // The exporters read the endpoint, the headers, the compression, and
      // the timeouts from the environment.
      this.tracerProvider = new sdkTrace.BasicTracerProvider({
        resource,
        spanProcessors: [
          new sdkTrace.BatchSpanProcessor(new OTLPTraceExporter()),
        ],
      });

      this.loggerProvider = new sdkLogs.LoggerProvider({
        resource,
        // Unlike the tracer provider, this one does not read the limit from
        // the environment itself.
        logRecordLimits: {
          attributeValueLengthLimit: otelCore.getNumberFromEnv(
            "OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT",
          ),
        },
        processors: [
          new sdkLogs.BatchLogRecordProcessor({
            exporter: new OTLPLogExporter(),
          }),
        ],
      });

      // AsyncLocalStorage keeps the active span attached across `await`s, so
      // nested spans parent themselves correctly without threading a Context
      // argument through every function.
      otelApi.context.setGlobalContextManager(
        new AsyncLocalStorageContextManager().enable(),
      );
      otelApi.propagation.setGlobalPropagator(PROPAGATOR);
      otelApi.trace.setGlobalTracerProvider(this.tracerProvider);
      logs.setGlobalLoggerProvider(this.loggerProvider);

      actionsCore.debug(
        `OpenTelemetry export enabled to ${otelCore.getStringFromEnv("OTEL_EXPORTER_OTLP_ENDPOINT")}`,
      );
    } catch (e: unknown) {
      this.tracerProvider = undefined;
      this.loggerProvider = undefined;
      actionsCore.debug(
        `Failed to start OpenTelemetry export, continuing without it: ${stringifyError(e)}`,
      );
    }
  }

  /**
   * Flush buffered spans and logs and tear the SDK down.
   *
   * Never throws and never hangs: the Action calls this on its way out, so a
   * broken or slow collector must not be able to fail or stall the workflow.
   */
  async shutdown(): Promise<void> {
    const providers = [this.tracerProvider, this.loggerProvider].flatMap(
      (p) => p ?? [],
    );

    if (providers.length === 0) {
      return;
    }

    try {
      await withTimeout(
        Promise.all(providers.map(async (p) => p.shutdown())),
        SHUTDOWN_TIMEOUT_MS,
      );
    } catch (e: unknown) {
      actionsCore.debug(
        `Error flushing OpenTelemetry data: ${stringifyError(e)}`,
      );
    } finally {
      this.tracerProvider = undefined;
      this.loggerProvider = undefined;
    }
  }
}

/**
 * The tracer for this library. Returns a no-op tracer until {@link
 * Telemetry.start} has run, so this is always safe to call.
 */
export function getTracer(): otelApi.Tracer {
  return otelApi.trace.getTracer(SCOPE_NAME, LIBRARY_VERSION);
}

/**
 * The logger for this library. Returns a no-op logger until {@link
 * Telemetry.start} has run, so this is always safe to call.
 */
export function getLogger(): Logger {
  return logs.getLogger(SCOPE_NAME, LIBRARY_VERSION);
}

/**
 * Emit a log record at `level`, correlated to whatever span is currently
 * active.
 */
export function emitLogRecord(
  level: LogLevel,
  message: string,
  attributes?: otelApi.Attributes,
): void {
  getLogger().emit({
    severityNumber: SEVERITY[level],
    severityText: level.toUpperCase(),
    body: message,
    attributes,
    context: otelApi.context.active(),
  });
}

/**
 * Serialize a span as a W3C `traceparent` header value, suitable for stashing
 * in the Action's state or handing to a child process.
 *
 * Returns undefined when telemetry is disabled, since the no-op span's context
 * is all zeroes and would not be a valid parent.
 */
export function traceparentOf(
  span: otelApi.Span | undefined,
): string | undefined {
  if (span === undefined || !otelApi.isSpanContextValid(span.spanContext())) {
    return undefined;
  }

  const carrier: Record<string, string> = {};
  PROPAGATOR.inject(
    otelApi.trace.setSpan(otelApi.ROOT_CONTEXT, span),
    carrier,
    otelApi.defaultTextMapSetter,
  );

  return carrier["traceparent"];
}

/**
 * Rebuild a Context from a W3C `traceparent` value, so a span started in one
 * process can parent spans started in another. Falls back to the root context
 * when `traceparent` is absent or unparseable.
 */
export function contextFromTraceparent(
  traceparent: string | undefined,
): otelApi.Context {
  if (traceparent === undefined || traceparent === "") {
    return otelApi.ROOT_CONTEXT;
  }

  return PROPAGATOR.extract(
    otelApi.ROOT_CONTEXT,
    { traceparent },
    otelApi.defaultTextMapGetter,
  );
}

/**
 * Mark `span` as failed and attach the exception to it.
 */
export function recordSpanError(span: otelApi.Span, error: unknown): void {
  span.recordException(
    error instanceof Error ? error : new Error(stringifyError(error)),
  );
  span.setStatus({
    code: otelApi.SpanStatusCode.ERROR,
    message: stringifyError(error),
  });
}

/**
 * Run `fn` inside a new active span, ending the span when it settles and
 * marking it failed if it throws. The error is always re-thrown: this records,
 * it does not swallow.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: otelApi.Span) => Promise<T>,
  attributes?: otelApi.Attributes,
): Promise<T> {
  return await getTracer().startActiveSpan(
    name,
    { attributes },
    async (span) => {
      try {
        return await fn(span);
      } catch (e: unknown) {
        recordSpanError(span, e);
        throw e;
      } finally {
        span.end();
      }
    },
  );
}

/** Reject if `promise` has not settled within `timeoutMs`. */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

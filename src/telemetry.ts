/**
 * @packageDocumentation
 * OpenTelemetry traces and logs for Determinate Systems' GitHub Actions.
 *
 * The OpenTelemetry API is a no-op until a provider is registered globally.
 * That means instrumentation call sites -- spans, log records -- can be
 * written unconditionally: when export is disabled (no endpoint, or the
 * feature flag is off) they cost nothing and no branching is needed at the
 * call site.
 */
import { stringifyError } from "./errors.js";
import * as actionsCore from "@actions/core";
import * as otelApi from "@opentelemetry/api";
import { type Logger, SeverityNumber, logs } from "@opentelemetry/api-logs";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import * as sdkLogs from "@opentelemetry/sdk-logs";
import * as sdkTrace from "@opentelemetry/sdk-trace-base";
import * as semconv from "@opentelemetry/semantic-conventions";

/** The instrumentation scope name for everything this library emits. */
export const SCOPE_NAME = "detsys-ts";

/**
 * The OTLP/HTTP collector every Action exports to, in the shape of
 * `OTEL_EXPORTER_OTLP_ENDPOINT`: `/v1/traces` and `/v1/logs` are appended.
 *
 * This is a fixed service. It is not one of the install.determinate.systems
 * backends discovered by SRV record, so it is not subject to their failover.
 */
const DEFAULT_OTLP_ENDPOINT = "https://otel.determinate.systems";

/**
 * The token {@link DEFAULT_OTLP_ENDPOINT} authenticates with, presented as
 * `Authorization: Bearer <token>` -- the default scheme of the collector's
 * `bearertokenauth` extension.
 *
 * This is a write-only ingest token, and it is public: it ships in `dist/`,
 * on npm, and in every workflow that vendors this library. It buys the
 * ability to send us telemetry and nothing else. Rotate it in the collector's
 * config and here together.
 */
const OTLP_INGEST_TOKEN =
  "8bfa2d8b689352981286f0149c4e55cc0dff30a4f7a735b560e31479904a74e1";

/**
 * How long to wait for buffered spans and logs to reach the collector before
 * giving up. The Action's process exits immediately afterward, so this is a
 * hard ceiling on how much a slow collector can delay a workflow.
 */
const SHUTDOWN_TIMEOUT_MS = 5_000;

/** Truncate any single span attribute longer than this. */
const MAX_ATTRIBUTE_VALUE_LENGTH = 8_192;

/**
 * Our own propagator instance, rather than the global one.
 *
 * The global propagator only exists once {@link Telemetry.start} has
 * registered it, which would make traceparent handling silently depend on
 * start-up ordering. Owning an instance keeps {@link traceparentOf} and {@link
 * contextFromTraceparent} correct no matter when they're called.
 */
const PROPAGATOR = new W3CTraceContextPropagator();

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
  serviceName: string;
  serviceVersion: string;

  /**
   * The OTLP/HTTP base URL, in the shape of `OTEL_EXPORTER_OTLP_ENDPOINT`:
   * `/v1/traces` and `/v1/logs` are appended to it.
   */
  endpoint: URL;

  /** Attributes describing this run, attached to every span and log record. */
  resourceAttributes: otelApi.Attributes;

  /** Headers to attach to every OTLP export request. */
  headers: Record<string, string>;

  /** How long a single OTLP export request may take. */
  requestTimeoutMs: number;
};

/**
 * The OTLP base endpoint to export to.
 *
 * `OTEL_EXPORTER_OTLP_ENDPOINT` overrides {@link DEFAULT_OTLP_ENDPOINT}, which
 * makes it easy to point a run at a local collector. Setting it to an empty
 * string turns export off. An unparseable value is ignored, and the default
 * applies.
 */
export function otlpEndpoint(): URL | undefined {
  const fromEnv = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];

  if (fromEnv === "") {
    return undefined;
  }

  if (fromEnv !== undefined) {
    try {
      return new URL(fromEnv);
    } catch (e: unknown) {
      actionsCore.info(
        `OTEL_EXPORTER_OTLP_ENDPOINT ignored: not a valid URL: ${stringifyError(e)}`,
      );
    }
  }

  return new URL(DEFAULT_OTLP_ENDPOINT);
}

/**
 * Whether `OTEL_EXPORTER_OTLP_ENDPOINT` names an endpoint.
 *
 * Doing so opts a run into export regardless of the feature flag, so the
 * export can be exercised in testing without a server-side rollout.
 */
export function otlpExplicitlyConfigured(): boolean {
  const fromEnv = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];
  return fromEnv !== undefined && fromEnv !== "";
}

/**
 * The headers every OTLP export request carries.
 *
 * Empty unless we are exporting to {@link DEFAULT_OTLP_ENDPOINT}: a run
 * pointed at somebody else's collector has no business presenting our token.
 * Staying quiet also keeps an `OTEL_EXPORTER_OTLP_HEADERS` the user set for
 * their own collector intact, since headers given in code beat the
 * environment key by key.
 */
export function otlpHeaders(): Record<string, string> {
  const endpoint = otlpEndpoint();

  if (endpoint?.toString() !== new URL(DEFAULT_OTLP_ENDPOINT).toString()) {
    return {};
  }

  return { Authorization: `Bearer ${OTLP_INGEST_TOKEN}` };
}

/**
 * Serialize headers for `OTEL_EXPORTER_OTLP_HEADERS`, which a child process's
 * own SDK reads.
 *
 * The variable is in W3C baggage format, and the SDK reading it back
 * percent-decodes each value -- so the space in `Bearer <token>` has to be
 * encoded here or the scheme and the token arrive as separate entries.
 *
 * Returns undefined when there are no headers, so the caller can leave the
 * variable unset rather than blanking one the user supplied.
 */
export function encodeOtlpHeaders(
  headers: Record<string, string>,
): string | undefined {
  const encoded = Object.entries(headers)
    .map(
      ([name, value]) =>
        `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    )
    .join(",");

  return encoded === "" ? undefined : encoded;
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
   * Register the global tracer and logger providers, pointed at `endpoint`.
   *
   * Safe to call at most once. If it throws, telemetry stays disabled and the
   * Action carries on: instrumentation degrades to the API's no-ops rather
   * than failing the workflow.
   */
  start(options: TelemetryOptions): void {
    if (this.enabled) {
      return;
    }

    try {
      const resource = resourceFromAttributes({
        [semconv.ATTR_SERVICE_NAME]: options.serviceName,
        [semconv.ATTR_SERVICE_VERSION]: options.serviceVersion,
        ...options.resourceAttributes,
      });

      const exporterOptions = {
        timeoutMillis: options.requestTimeoutMs,
        headers: options.headers,
      };

      this.tracerProvider = new sdkTrace.BasicTracerProvider({
        resource,
        // Recorded events can carry large payloads -- stapled log files are
        // gzipped and base64'd into the exception event, and can run to
        // megabytes. Traces are the wrong place for those, so truncate rather
        // than ship them: the diagnostics endpoint still gets them in full.
        spanLimits: {
          attributeValueLengthLimit: MAX_ATTRIBUTE_VALUE_LENGTH,
        },
        spanProcessors: [
          new sdkTrace.BatchSpanProcessor(
            new OTLPTraceExporter({
              url: signalUrl(options.endpoint, "v1/traces").toString(),
              ...exporterOptions,
            }),
          ),
        ],
      });

      this.loggerProvider = new sdkLogs.LoggerProvider({
        resource,
        logRecordLimits: {
          attributeValueLengthLimit: MAX_ATTRIBUTE_VALUE_LENGTH,
        },
        processors: [
          new sdkLogs.BatchLogRecordProcessor({
            exporter: new OTLPLogExporter({
              url: signalUrl(options.endpoint, "v1/logs").toString(),
              ...exporterOptions,
            }),
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

      actionsCore.debug(`OpenTelemetry export enabled to ${options.endpoint}`);
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
  return otelApi.trace.getTracer(SCOPE_NAME);
}

/**
 * The logger for this library. Returns a no-op logger until {@link
 * Telemetry.start} has run, so this is always safe to call.
 */
export function getLogger(): Logger {
  return logs.getLogger(SCOPE_NAME);
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

/** Join a signal-specific path onto an OTLP base endpoint. */
function signalUrl(base: URL, signalPath: string): URL {
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/\/$/, "")}/${signalPath}`;
  return url;
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

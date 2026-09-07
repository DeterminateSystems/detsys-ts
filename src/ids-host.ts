/**
 * @packageDocumentation
 * Identifies and discovers backend servers for install.determinate.systems
 */
import { stringifyError } from "./errors.js";
import {
  type HttpClientOutcome,
  endHttpClientSpan,
  startHttpClientSpan,
  traceContextHeaders,
} from "./telemetry.js";
import * as actionsCore from "@actions/core";
import type { Attributes, Span } from "@opentelemetry/api";
import got, { type Got, type RequestError, TimeoutError } from "got";
import type { SrvRecord } from "node:dns";
import { resolveSrv } from "node:dns/promises";

const DEFAULT_LOOKUP = "_detsys_ids._tcp.install.determinate.systems.";
const ALLOWED_SUFFIXES = [
  ".install.determinate.systems",
  ".install.detsys.dev",
];

const DEFAULT_IDS_HOST = "https://install.determinate.systems";

/**
 * Where the span of one attempt waits, between the hook that starts it and the
 * hook that ends it. `got` gives each attempt a context of its own.
 */
const SPAN_KEY = "detsysHttpSpan";

/**
 * End the span that {@link SPAN_KEY} holds, if the request started one.
 *
 * Each of `afterResponse`, `beforeRetry`, and `beforeError` ends an attempt,
 * and only one of them runs for each attempt.
 */
function endRequestSpan(
  context: Record<string, unknown>,
  outcome: HttpClientOutcome,
): void {
  const span = context[SPAN_KEY] as Span | undefined;
  delete context[SPAN_KEY];

  endHttpClientSpan(span, outcome);
}

/**
 * How long each phase of a request that timed out took.
 *
 * A timeout says only that a request did not finish. These say how far it got,
 * which is what tells a slow name lookup from a slow server.
 */
function timingAttributes(error: RequestError): Attributes | undefined {
  if (!(error instanceof TimeoutError) || error.timings === undefined) {
    return undefined;
  }

  const attributes: Attributes = {};

  for (const [phase, value] of Object.entries(error.timings.phases)) {
    if (Number.isFinite(value)) {
      attributes[`detsys.http.timing.${phase}`] = value;
    }
  }

  return attributes;
}
const LOOKUP = process.env["IDS_LOOKUP"] ?? DEFAULT_LOOKUP;

const DEFAULT_TIMEOUT = 10_000; // 10 seconds in ms

/**
 * Host information for install.determinate.systems.
 */
export class IdsHost {
  private idsProjectName: string;
  private diagnosticsSuffix?: string;
  private runtimeDiagnosticsUrl?: string;
  private prioritizedURLs?: URL[];
  private client?: Got;
  private timeout: number;

  constructor(
    idsProjectName: string,
    diagnosticsSuffix: string | undefined,
    runtimeDiagnosticsUrl: string | undefined,
    timeout: number = DEFAULT_TIMEOUT,
  ) {
    this.idsProjectName = idsProjectName;
    this.diagnosticsSuffix = diagnosticsSuffix;
    this.runtimeDiagnosticsUrl = runtimeDiagnosticsUrl;
    this.client = undefined;
    this.timeout = timeout;
  }

  async getGot(
    recordFailoverCallback?: (
      incitingError: unknown,
      prevUrl: URL,
      nextUrl: URL,
    ) => void,
  ): Promise<Got> {
    if (this.client === undefined) {
      this.client = got.extend({
        timeout: {
          request: this.timeout,
        },

        retry: {
          limit: Math.max((await this.getUrlsByPreference()).length, 3),
          methods: ["GET", "HEAD"],
        },

        hooks: {
          beforeRetry: [
            async (error, retryCount) => {
              // A retried attempt reaches neither `afterResponse` nor
              // `beforeError`, thus its span ends here or it never ends.
              endRequestSpan(error.options.context, {
                error,
                attributes: timingAttributes(error),
              });

              const prevUrl = await this.getRootUrl();
              this.markCurrentHostBroken();
              const nextUrl = await this.getRootUrl();

              if (recordFailoverCallback !== undefined) {
                recordFailoverCallback(error, prevUrl, nextUrl);
              }

              actionsCore.info(
                `Retrying after error ${error.code}, retry #: ${retryCount}`,
              );
            },
          ],

          beforeRequest: [
            async (options) => {
              // The getter always returns a URL, even though the setter accepts a string
              const currentUrl: URL = options.url as URL;

              if (this.isUrlSubjectToDynamicUrls(currentUrl)) {
                const newUrl: URL = new URL(currentUrl);

                const url: URL = await this.getRootUrl();
                newUrl.host = url.host;

                options.url = newUrl;
                actionsCore.debug(`Transmuted ${currentUrl} into ${newUrl}`);
              } else {
                actionsCore.debug(`No transmutations on ${currentUrl}`);
              }

              // The span of this attempt covers the request that goes out
              // below, and each retry gets one of its own.
              const span = startHttpClientSpan(
                options.method,
                options.url as URL,
              );
              options.context[SPAN_KEY] = span;

              // Send the trace context, so the service puts the work it does
              // for this request in this Action's trace.
              for (const [name, value] of Object.entries(
                traceContextHeaders(span),
              )) {
                options.headers[name] = value;
              }
            },
          ],

          afterResponse: [
            (response) => {
              endRequestSpan(response.request.options.context, {
                statusCode: response.statusCode,
              });

              return response;
            },
          ],

          beforeError: [
            (error) => {
              endRequestSpan(error.options.context, {
                error,
                statusCode: error.response?.statusCode,
                attributes: timingAttributes(error),
              });

              return error;
            },
          ],
        },
      });
    }

    return this.client;
  }

  markCurrentHostBroken(): void {
    this.prioritizedURLs?.shift();
  }

  setPrioritizedUrls(urls: URL[]): void {
    this.prioritizedURLs = urls;
  }

  isUrlSubjectToDynamicUrls(url: URL): boolean {
    if (url.origin === DEFAULT_IDS_HOST) {
      return true;
    }

    for (const suffix of ALLOWED_SUFFIXES) {
      if (url.host.endsWith(suffix)) {
        return true;
      }
    }

    return false;
  }

  async getDynamicRootUrl(): Promise<URL | undefined> {
    const idsHost = process.env["IDS_HOST"];
    if (idsHost !== undefined) {
      try {
        return new URL(idsHost);
      } catch (err: unknown) {
        actionsCore.error(
          `IDS_HOST environment variable is not a valid URL. Ignoring. ${stringifyError(err)}`,
        );
      }
    }

    let url: URL | undefined = undefined;
    try {
      const urls = await this.getUrlsByPreference();
      url = urls[0];
    } catch (err: unknown) {
      actionsCore.error(
        `Error collecting IDS URLs by preference: ${stringifyError(err)}`,
      );
    }

    if (url === undefined) {
      return undefined;
    } else {
      // This is a load-bearing `new URL(url)` so that callers can't mutate
      // getRootUrl's return value.
      return new URL(url);
    }
  }

  async getRootUrl(): Promise<URL> {
    const url = await this.getDynamicRootUrl();

    if (url === undefined) {
      return new URL(DEFAULT_IDS_HOST);
    }

    return url;
  }

  /**
   * The diagnostics endpoint of the current backend.
   *
   * This library reports nothing there: its telemetry is OpenTelemetry. The
   * URL is for the programs an Action runs, which have diagnostics of their
   * own.
   */
  async getDiagnosticsUrl(): Promise<URL | undefined> {
    if (this.runtimeDiagnosticsUrl === "") {
      // User specifically set the diagnostics URL to an empty string
      // so disable diagnostics
      return undefined;
    }

    if (
      this.runtimeDiagnosticsUrl !== "-" &&
      this.runtimeDiagnosticsUrl !== undefined
    ) {
      try {
        // Caller specified a specific diagnostics URL
        return new URL(this.runtimeDiagnosticsUrl);
      } catch (err: unknown) {
        actionsCore.info(
          `User-provided diagnostic endpoint ignored: not a valid URL: ${stringifyError(err)}`,
        );
      }
    }

    try {
      const diagnosticUrl = await this.getRootUrl();
      diagnosticUrl.pathname += "events/batch";
      return diagnosticUrl;
    } catch (err: unknown) {
      actionsCore.info(
        `Generated diagnostic endpoint ignored, and diagnostics are disabled: not a valid URL: ${stringifyError(err)}`,
      );
      return undefined;
    }
  }

  private async getUrlsByPreference(): Promise<URL[]> {
    if (this.prioritizedURLs === undefined) {
      this.prioritizedURLs = orderRecordsByPriorityWeight(
        await discoverServiceRecords(),
      ).flatMap((record) => recordToUrl(record) || []);
    }

    return this.prioritizedURLs;
  }
}

export function recordToUrl(record: SrvRecord): URL | undefined {
  const urlStr = `https://${record.name}:${record.port}`;
  try {
    return new URL(urlStr);
  } catch (err: unknown) {
    actionsCore.debug(
      `Record ${JSON.stringify(record)} produced an invalid URL: ${urlStr} (${err})`,
    );
    return undefined;
  }
}

async function discoverServiceRecords(): Promise<SrvRecord[]> {
  return await discoverServicesStub(resolveSrv(LOOKUP), 1_000);
}

export async function discoverServicesStub(
  lookup: Promise<SrvRecord[]>,
  timeout: number,
): Promise<SrvRecord[]> {
  const defaultFallback: Promise<SrvRecord[]> = new Promise(
    (resolve, _reject) => {
      setTimeout(resolve, timeout, []);
    },
  );

  let records: SrvRecord[];

  try {
    records = await Promise.race([lookup, defaultFallback]);
  } catch (reason: unknown) {
    actionsCore.debug(`Error resolving SRV records: ${stringifyError(reason)}`);
    records = [];
  }

  const acceptableRecords = records.filter((record: SrvRecord): boolean => {
    for (const suffix of ALLOWED_SUFFIXES) {
      if (record.name.endsWith(suffix)) {
        return true;
      }
    }

    actionsCore.debug(
      `Unacceptable domain due to an invalid suffix: ${record.name}`,
    );

    return false;
  });

  if (acceptableRecords.length === 0) {
    actionsCore.debug(`No records found for ${LOOKUP}`);
  } else {
    actionsCore.debug(
      `Resolved ${LOOKUP} to ${JSON.stringify(acceptableRecords)}`,
    );
  }

  return acceptableRecords;
}

export function orderRecordsByPriorityWeight(
  records: SrvRecord[],
): SrvRecord[] {
  const byPriorityWeight: Map<number, SrvRecord[]> = new Map();
  for (const record of records) {
    const existing = byPriorityWeight.get(record.priority);
    if (existing) {
      existing.push(record);
    } else {
      byPriorityWeight.set(record.priority, [record]);
    }
  }

  const prioritizedRecords: SrvRecord[] = [];
  const keys: number[] = Array.from(byPriorityWeight.keys()).sort(
    (a, b) => a - b,
  );

  for (const priority of keys) {
    const recordsByPrio = byPriorityWeight.get(priority);
    if (recordsByPrio === undefined) {
      continue;
    }

    prioritizedRecords.push(...weightedRandom(recordsByPrio));
  }

  return prioritizedRecords;
}

export function weightedRandom(records: SrvRecord[]): SrvRecord[] {
  // Duplicate records so we don't accidentally change our caller's data
  const scratchRecords: SrvRecord[] = records.slice();
  const result: SrvRecord[] = [];

  while (scratchRecords.length > 0) {
    const weights: number[] = [];

    {
      for (let i = 0; i < scratchRecords.length; i++) {
        weights.push(
          scratchRecords[i].weight + (i > 0 ? scratchRecords[i - 1].weight : 0),
        );
      }
    }

    const point = Math.random() * weights[weights.length - 1];

    for (
      let selectedIndex = 0;
      selectedIndex < weights.length;
      selectedIndex++
    ) {
      if (weights[selectedIndex] > point) {
        // Remove our selected record and add it to the result
        result.push(scratchRecords.splice(selectedIndex, 1)[0]);
        break;
      }
    }
  }

  return result;
}

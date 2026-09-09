/**
 * @packageDocumentation
 * The OpenTelemetry `http.*`, `server.*` and `url.*` attributes of a request
 * this library makes.
 *
 * A span that carries these says which server answered, how it answered, and
 * how long each part of the exchange took. Without them a slow download and a
 * refused download look the same.
 *
 * The query string is not here, on purpose. A download URL carries a
 * signature, and the check-in URL carries the correlation of the run.
 * Telemetry is not the place for either. The host and the path say which
 * server was slow, and they carry no secret.
 */
import type * as otelApi from "@opentelemetry/api";
import * as semconv from "@opentelemetry/semantic-conventions";

/** How long each phase of a request took, in milliseconds. */
const ATTR_TIMING_PREFIX = "detsys.http.timing.";

/**
 * The attributes of a request that is about to go out.
 *
 * @param method - The HTTP method, in upper case.
 * @param url - Where the request goes. Its query is not reported.
 */
export function requestAttributes(
  method: string,
  url: URL,
): otelApi.Attributes {
  return withValues({
    [semconv.ATTR_HTTP_REQUEST_METHOD]: method,
    [semconv.ATTR_SERVER_ADDRESS]: url.hostname,
    [semconv.ATTR_URL_SCHEME]: url.protocol.replace(/:$/, ""),
    [semconv.ATTR_URL_PATH]: url.pathname,
  });
}

/**
 * The attributes of a response that arrived.
 *
 * `http.request.resend_count` is only there when the request went out more
 * than once, which is what the conventions ask for.
 *
 * @param statusCode - The status the server answered with, if it answered.
 * @param resendCount - How many times got sent the request again.
 */
export function responseAttributes(
  statusCode: number | undefined,
  resendCount = 0,
): otelApi.Attributes {
  return withValues({
    [semconv.ATTR_HTTP_RESPONSE_STATUS_CODE]: statusCode,
    ...(resendCount > 0
      ? { [semconv.ATTR_HTTP_REQUEST_RESEND_COUNT]: resendCount }
      : {}),
  });
}

/**
 * The time each phase of a request took, as `detsys.http.timing.*`.
 *
 * got names its phases in camelCase and the conventions want snake_case,
 * thus `firstByte` is reported as `first_byte`. A phase that did not happen
 * has no number, and a number that is not finite says nothing.
 *
 * @param phases - `timings.phases` of a got request.
 */
export function timingAttributes(phases: {
  [phase: string]: number | undefined;
}): otelApi.Attributes {
  return Object.fromEntries(
    Object.entries(phases)
      .filter(([, value]) => Number.isFinite(value))
      .map(([phase, value]) => [
        `${ATTR_TIMING_PREFIX}${snakeCase(phase)}`,
        value,
      ]),
  );
}

/** A camelCase name as the conventions spell it, which is snake_case. */
function snakeCase(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * The attributes that have a value.
 *
 * An attribute with no value is not an attribute.
 */
function withValues(attributes: otelApi.Attributes): otelApi.Attributes {
  return Object.fromEntries(
    Object.entries(attributes).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  );
}

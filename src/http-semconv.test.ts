import {
  requestAttributes,
  responseAttributes,
  timingAttributes,
} from "./http-semconv.js";
import { describe, expect, test } from "vitest";

describe("requestAttributes", () => {
  test("the server and the path, and not the query", () => {
    expect(
      requestAttributes(
        "GET",
        new URL("https://install.determinate.systems/nix?correlation=secret"),
      ),
    ).toStrictEqual({
      "http.request.method": "GET",
      "server.address": "install.determinate.systems",
      "url.scheme": "https",
      "url.path": "/nix",
    });
  });

  test("a root has a path all the same", () => {
    expect(requestAttributes("POST", new URL("http://example.com"))).toEqual(
      expect.objectContaining({ "url.path": "/", "url.scheme": "http" }),
    );
  });
});

describe("responseAttributes", () => {
  test("the status the server answered with", () => {
    expect(responseAttributes(200)).toStrictEqual({
      "http.response.status_code": 200,
    });
  });

  test("a request sent once reports no resend count", () => {
    expect(responseAttributes(200, 0)).toStrictEqual({
      "http.response.status_code": 200,
    });
  });

  test("a request sent again says how many times", () => {
    expect(responseAttributes(503, 2)).toStrictEqual({
      "http.response.status_code": 503,
      "http.request.resend_count": 2,
    });
  });

  test("a request that got no answer has no status", () => {
    expect(responseAttributes(undefined, 1)).toStrictEqual({
      "http.request.resend_count": 1,
    });
  });
});

describe("timingAttributes", () => {
  test("got's camelCase becomes snake_case", () => {
    expect(
      timingAttributes({
        wait: 1,
        dns: 2,
        tcp: 3,
        tls: 4,
        request: 5,
        firstByte: 6,
        download: 7,
        total: 8,
      }),
    ).toStrictEqual({
      "detsys.http.timing.wait": 1,
      "detsys.http.timing.dns": 2,
      "detsys.http.timing.tcp": 3,
      "detsys.http.timing.tls": 4,
      "detsys.http.timing.request": 5,
      "detsys.http.timing.first_byte": 6,
      "detsys.http.timing.download": 7,
      "detsys.http.timing.total": 8,
    });
  });

  test("a phase that did not happen is not reported", () => {
    expect(
      timingAttributes({ dns: undefined, tls: NaN, total: 9 }),
    ).toStrictEqual({ "detsys.http.timing.total": 9 });
  });
});

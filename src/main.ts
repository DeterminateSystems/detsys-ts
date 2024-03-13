import * as actions_core from "@actions/core";
import * as actionsCache from "@actions/cache";
import * as path from "node:path";
// eslint-disable-next-line import/no-unresolved
import got from "got";
import { v4 as uuidV4 } from "uuid";
import { createWriteStream } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
// eslint-disable-next-line import/no-unresolved
import { SourceDef, constructSourceParameters } from "./sourcedef.js";
// eslint-disable-next-line import/no-unresolved
import * as platform from "./platform.js";
// eslint-disable-next-line import/no-unresolved
import * as correlation from "./correlation.js";

const gotClient = got.extend({
  retry: {
    limit: 3,
    methods: ["GET", "HEAD"],
  },
  hooks: {
    beforeRetry: [
      (error, retryCount) => {
        actions_core.info(
          `Retrying after error ${error.code}, retry #: ${retryCount}`,
        );
      },
    ],
  },
});

export type FetchSuffixStyle = "nix-style" | "gh-env-style" | "universal";

export class IdsToolbox {
  projectName: string;
  archOs: string;
  nixSystem: string;
  architectureFetchSuffix: string;
  sourceParameters: SourceDef;

  constructor(
    projectName: string,
    fetchStyle: FetchSuffixStyle,
    legacySourcePrefix?: string,
  ) {
    this.projectName = projectName;

    this.archOs = platform.getArchOs();
    this.nixSystem = platform.getNixPlatform(this.archOs);

    if (fetchStyle === "gh-env-style") {
      this.architectureFetchSuffix = this.archOs;
    } else if (fetchStyle === "nix-style") {
      this.architectureFetchSuffix = this.nixSystem;
    } else if (fetchStyle === "universal") {
      this.architectureFetchSuffix = "universal";
    } else {
      throw new Error(`fetchStyle ${fetchStyle} is not a valid style`);
    }

    this.sourceParameters = constructSourceParameters(legacySourcePrefix);
  }

  private getUrl(): URL {
    const p = this.sourceParameters;

    if (p.url) {
      return new URL(p.url);
    }

    const fetchUrl = new URL("https://install.determinate.systems/");
    fetchUrl.pathname += this.projectName;

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

    return fetchUrl;
  }

  private cacheKey(version: string): string {
    const cleanedVersion = version.replace(/[^a-zA-Z0-9-+.]/g, "");
    return `determinatesystem-${this.projectName}-${this.architectureFetchSuffix}-${cleanedVersion}`;
  }

  private async getCachedVersion(version: string): Promise<undefined | string> {
    const startCwd = process.cwd();

    try {
      const tempDir = this.getTemporaryName();
      await mkdir(tempDir);
      process.chdir(tempDir);

      if (
        await actionsCache.restoreCache(
          [this.projectName],
          this.cacheKey(version),
          [],
          undefined,
          true,
        )
      ) {
        return `${tempDir}/${this.projectName}`;
      }

      return undefined;
    } finally {
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
      await copyFile(toolPath, `${tempDir}/${this.projectName}`);

      await actionsCache.saveCache(
        [this.projectName],
        this.cacheKey(version),
        undefined,
        true,
      );
    } finally {
      process.chdir(startCwd);
    }
  }

  async fetch(): Promise<string> {
    actions_core.info(`Fetching from ${this.getUrl()}`);

    const correlatedUrl = this.getUrl();
    correlatedUrl.searchParams.set("ci", "github");
    correlatedUrl.searchParams.set(
      "correlation",
      JSON.stringify(correlation.identify()),
    );

    const versionCheckup = await gotClient.head(correlatedUrl);
    if (versionCheckup.headers.etag) {
      const v = versionCheckup.headers.etag;

      actions_core.debug(
        `Checking the tool cache for ${this.getUrl()} at ${v}`,
      );
      const cached = await this.getCachedVersion(v);
      if (cached) {
        actions_core.debug(`Tool cache hit.`);
        return cached;
      }
    }

    actions_core.debug(
      `No match from the cache, re-fetching from the redirect: ${versionCheckup.url}`,
    );

    const destFile = this.getTemporaryName();
    const fetchStream = gotClient.stream(versionCheckup.url);

    await pipeline(
      fetchStream,
      createWriteStream(destFile, {
        encoding: "binary",
        mode: 0o755,
      }),
    );

    if (fetchStream.response?.headers.etag) {
      const v = fetchStream.response.headers.etag;

      await this.saveCachedVersion(v, destFile);
    }

    return destFile;
  }

  private getTemporaryName(): string {
    const _tmpdir = process.env["RUNNER_TEMP"] || tmpdir();
    return path.join(_tmpdir, `${this.projectName}-${uuidV4()}`);
  }
}

// eslint-disable-next-line import/no-unresolved
import * as correlation from "./correlation.js";
// eslint-disable-next-line import/no-unresolved
import * as platform from "./platform.js";
// eslint-disable-next-line import/no-unresolved
import { SourceDef, constructSourceParameters } from "./sourcedef.js";
import * as actionsCache from "@actions/cache";
import { DownloadOptions, UploadOptions } from "@actions/cache/lib/options.js";
import * as actions_core from "@actions/core";
// eslint-disable-next-line import/no-unresolved
import got from "got";
import { createWriteStream } from "node:fs";
import fs, { chmod, copyFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { pipeline } from "node:stream/promises";
import { v4 as uuidV4 } from "uuid";

const DEFAULT_CACHE_KEY_PREFIX = "determinatesystems";

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

export type Options = {
  name: string;
  fetchStyle: FetchSuffixStyle;
  idsProjectName?: string;
  legacySourcePrefix?: string;
  cacheKeyPrefix?: string;
};

// A confident version of Options, where defaults have been processed
type ConfidentOptions = {
  name: string;
  idsProjectName: string;
  fetchStyle: FetchSuffixStyle;
  cacheKeyPrefix: string;
  legacySourcePrefix?: string;
};

function makeOptionsConfident(options: Options): ConfidentOptions {
  return {
    name: options.name,
    idsProjectName: options.idsProjectName || options.name,
    fetchStyle: options.fetchStyle,
    cacheKeyPrefix: options.cacheKeyPrefix || DEFAULT_CACHE_KEY_PREFIX,
    legacySourcePrefix: options.legacySourcePrefix,
  };
}

export class IdsToolbox {
  identity: correlation.AnonymizedCorrelationHashes;
  options: ConfidentOptions;
  archOs: string;
  nixSystem: string;
  architectureFetchSuffix: string;
  sourceParameters: SourceDef;
  cacheKeyPrefix: string;

  constructor(options: Options) {
    this.options = makeOptionsConfident(options);

    this.identity = correlation.identify();
    this.archOs = platform.getArchOs();
    this.nixSystem = platform.getNixPlatform(this.archOs);

    if (options.fetchStyle === "gh-env-style") {
      this.architectureFetchSuffix = this.archOs;
    } else if (options.fetchStyle === "nix-style") {
      this.architectureFetchSuffix = this.nixSystem;
    } else if (options.fetchStyle === "universal") {
      this.architectureFetchSuffix = "universal";
    } else {
      throw new Error(`fetchStyle ${options.fetchStyle} is not a valid style`);
    }

    this.sourceParameters = constructSourceParameters(
      options.legacySourcePrefix,
    );
  }

  private getUrl(): URL {
    const p = this.sourceParameters;

    if (p.url) {
      return new URL(p.url);
    }

    const fetchUrl = new URL("https://install.determinate.systems/");
    fetchUrl.pathname += this.options.idsProjectName;

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
    return `${this.cacheKeyPrefix}-${this.options.name}-${this.architectureFetchSuffix}-${cleanedVersion}`;
  }

  private async getCachedVersion(version: string): Promise<undefined | string> {
    type RestoreCacheOptions = {
      paths: string[];
      primaryKey: string;
      restoreKeys: string[];
      downloadOptions: DownloadOptions | undefined;
      enableCrossOsArchive: boolean;
    };

    const startCwd = process.cwd();
    const name = this.options.name;

    try {
      const tempDir = this.getTemporaryName();
      await mkdir(tempDir);
      process.chdir(tempDir);

      const options: RestoreCacheOptions = {
        paths: [name],
        primaryKey: this.cacheKey(version),
        restoreKeys: [],
        downloadOptions: undefined,
        enableCrossOsArchive: true,
      };

      if (
        await actionsCache.restoreCache(
          options.paths,
          options.primaryKey,
          options.restoreKeys,
          options.downloadOptions,
          options.enableCrossOsArchive,
        )
      ) {
        return `${tempDir}/${name}`;
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
    type SaveCacheOptions = {
      paths: string[];
      key: string;
      uploadOptions: UploadOptions | undefined;
      enableCrossOsArchive: boolean;
    };

    const startCwd = process.cwd();
    const name = this.options.name;

    try {
      const tempDir = this.getTemporaryName();
      await mkdir(tempDir);
      process.chdir(tempDir);
      await copyFile(toolPath, `${tempDir}/${this.options.name}`);

      const options: SaveCacheOptions = {
        paths: [name],
        key: this.cacheKey(version),
        uploadOptions: undefined,
        enableCrossOsArchive: true,
      };

      await actionsCache.saveCache(
        options.paths,
        options.key,
        options.uploadOptions,
        options.enableCrossOsArchive,
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
      JSON.stringify(this.identity),
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

  async fetchExecutable(): Promise<string> {
    const binaryPath = await this.fetch();
    await chmod(binaryPath, fs.constants.S_IXUSR | fs.constants.S_IXGRP);
    return binaryPath;
  }

  private getTemporaryName(): string {
    const _tmpdir = process.env["RUNNER_TEMP"] || tmpdir();
    return path.join(_tmpdir, `${this.options.name}-${uuidV4()}`);
  }
}

import * as correlation from "./correlation";
// eslint-disable-next-line import/extensions
import pkg from "./package.json";
import * as platform from "./platform";
import { SourceDef, constructSourceParameters } from "./sourcedef";
import * as actionsCache from "@actions/cache";
import * as actionsCore from "@actions/core";
import got, { Got } from "got";
import { createWriteStream } from "node:fs";
import fs, { chmod, copyFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { pipeline } from "node:stream/promises";
import { v4 as uuidV4 } from "uuid";

const DEFAULT_IDS_HOST = "https://install.determinate.systems";
const IDS_HOST = process.env["IDS_HOST"] ?? DEFAULT_IDS_HOST;

const gotClient = got.extend({
  retry: {
    limit: 3,
    methods: ["GET", "HEAD"],
  },
  hooks: {
    beforeRetry: [
      (error, retryCount) => {
        actionsCore.info(
          `Retrying after error ${error.code}, retry #: ${retryCount}`,
        );
      },
    ],
  },
});

export type FetchSuffixStyle = "nix-style" | "gh-env-style" | "universal";
export type ExecutionPhase = "main" | "post";

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

  // The URL to send diagnostics events to.
  // Specifically:
  //  * `undefined` -> Attempt to read the `diagnostic-enpdoint` action input, and calculate the default diagnostics URL for IDS from there.
  //  * `null` -> Disable sending diagnostics altogether.
  //  * URL(...) -> Send diagnostics to this other URL instead
  diagnosticsUrl?: URL | null;
};

// A confident version of Options, where defaults have been resolved into final values
type ConfidentActionOptions = {
  name: string;
  idsProjectName: string;
  eventPrefix: string;
  fetchStyle: FetchSuffixStyle;
  legacySourcePrefix?: string;
  diagnosticsUrl?: URL;
};

type DiagnosticEvent = {
  event_name: string;
  correlation: correlation.AnonymizedCorrelationHashes;
  facts: Record<string, string | boolean>;
  context: Record<string, unknown>;
  timestamp: Date;
};

export class IdsToolbox {
  private identity: correlation.AnonymizedCorrelationHashes;
  private actionOptions: ConfidentActionOptions;
  private archOs: string;
  private nixSystem: string;
  private architectureFetchSuffix: string;
  private executionPhase: ExecutionPhase;
  private sourceParameters: SourceDef;
  private facts: Record<string, string | boolean>;
  private events: DiagnosticEvent[];
  private client: Got;

  constructor(actionOptions: ActionOptions) {
    this.actionOptions = makeOptionsConfident(actionOptions);
    this.events = [];
    this.client = got.extend({
      retry: {
        limit: 3,
        methods: ["GET", "HEAD"],
      },
      hooks: {
        beforeRetry: [
          (error, retryCount) => {
            actionsCore.info(
              `Retrying after error ${error.code}, retry #: ${retryCount}`,
            );
          },
        ],
      },
    });

    this.facts = {
      $lib: "idslib",
      $lib_version: pkg.version,
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

    this.identity = correlation.identify(this.actionOptions.name);
    this.archOs = platform.getArchOs();
    this.nixSystem = platform.getNixPlatform(this.archOs);

    this.facts.arch_os = this.archOs;
    this.facts.nix_system = this.nixSystem;

    {
      const phase = actionsCore.getState("idstoolbox_execution_phase");
      if (phase === "") {
        actionsCore.saveState("idstoolbox_execution_phase", "post");
        this.executionPhase = "main";
      } else {
        this.executionPhase = "post";
      }
      this.facts.execution_phase = this.executionPhase;
    }

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

    this.sourceParameters = constructSourceParameters(
      this.actionOptions.legacySourcePrefix,
    );

    this.recordEvent(`begin_${this.executionPhase}`);
  }

  recordEvent(eventName: string, context: Record<string, unknown> = {}): void {
    this.events.push({
      event_name: `${this.actionOptions.eventPrefix}${eventName}`,
      context,
      correlation: this.identity,
      facts: this.facts,
      timestamp: new Date(),
    });
  }

  async fetch(): Promise<string> {
    actionsCore.info(`Fetching from ${this.getUrl()}`);

    const correlatedUrl = this.getUrl();
    correlatedUrl.searchParams.set("ci", "github");
    correlatedUrl.searchParams.set(
      "correlation",
      JSON.stringify(this.identity),
    );

    const versionCheckup = await gotClient.head(correlatedUrl);
    if (versionCheckup.headers.etag) {
      const v = versionCheckup.headers.etag;

      actionsCore.debug(`Checking the tool cache for ${this.getUrl()} at ${v}`);
      const cached = await this.getCachedVersion(v);
      if (cached) {
        this.facts["artifact_fetched_from_cache"] = true;
        actionsCore.debug(`Tool cache hit.`);
        return cached;
      }
    }

    this.facts["artifact_fetched_from_cache"] = false;

    actionsCore.debug(
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

      try {
        await this.saveCachedVersion(v, destFile);
      } catch (e) {
        actionsCore.debug(`Error caching the artifact: ${e}`);
      }
    }

    return destFile;
  }

  async fetchExecutable(): Promise<string> {
    const binaryPath = await this.fetch();
    await chmod(binaryPath, fs.constants.S_IXUSR | fs.constants.S_IXGRP);
    return binaryPath;
  }

  async complete(): Promise<void> {
    this.recordEvent(`complete_${this.executionPhase}`);
    await this.submitEvents();
  }

  private getUrl(): URL {
    const p = this.sourceParameters;

    if (p.url) {
      return new URL(p.url);
    }

    const fetchUrl = new URL(IDS_HOST);
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

    return fetchUrl;
  }

  private cacheKey(version: string): string {
    const cleanedVersion = version.replace(/[^a-zA-Z0-9-+.]/g, "");
    return `determinatesystem-${this.actionOptions.name}-${this.architectureFetchSuffix}-${cleanedVersion}`;
  }

  private async getCachedVersion(version: string): Promise<undefined | string> {
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
          this.cacheKey(version),
          [],
          undefined,
          true,
        )
      ) {
        this.recordEvent("artifact_cache_hit");
        return `${tempDir}/${this.actionOptions.name}`;
      }

      this.recordEvent("artifact_cache_miss");
      return undefined;
    } finally {
      process.env.GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE_BACKUP;
      delete process.env.GITHUB_WORKSPACE_BACKUP;
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
      await copyFile(toolPath, `${tempDir}/${this.actionOptions.name}`);

      // extremely evil shit right here:
      process.env.GITHUB_WORKSPACE_BACKUP = process.env.GITHUB_WORKSPACE;
      delete process.env.GITHUB_WORKSPACE;

      await actionsCache.saveCache(
        [this.actionOptions.name],
        this.cacheKey(version),
        undefined,
        true,
      );
      this.recordEvent("artifact_cache_hit");
    } finally {
      process.env.GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE_BACKUP;
      delete process.env.GITHUB_WORKSPACE_BACKUP;
      process.chdir(startCwd);
    }
  }

  private async submitEvents(): Promise<void> {
    if (!this.actionOptions.diagnosticsUrl) {
      actionsCore.debug(
        "Diagnostics are disabled. Not sending the following events:",
      );
      actionsCore.debug(JSON.stringify(this.events, undefined, 2));
      return;
    }

    const batch = {
      type: "eventlog",
      sent_at: new Date(),
      events: this.events,
    };

    try {
      await gotClient.post(this.actionOptions.diagnosticsUrl, {
        json: batch,
      });
    } catch (error) {
      actionsCore.debug(`Error submitting diagnostics event: ${error}`);
    }
    this.events = [];
  }

  private getTemporaryName(): string {
    const _tmpdir = process.env["RUNNER_TEMP"] || tmpdir();
    return path.join(_tmpdir, `${this.actionOptions.name}-${uuidV4()}`);
  }
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
    diagnosticsUrl: determineDiagnosticsUrl(
      idsProjectName,
      actionOptions.diagnosticsUrl,
    ),
  };

  actionsCore.debug("idslib options:");
  actionsCore.debug(JSON.stringify(finalOpts, undefined, 2));

  return finalOpts;
}

function determineDiagnosticsUrl(
  idsProjectName: string,
  urlOption?: URL | null,
): undefined | URL {
  if (urlOption === null) {
    // Disable diagnostict events
    return undefined;
  }

  if (urlOption !== undefined) {
    // Caller specified a specific diagnostics URL
    return urlOption;
  }

  {
    // Attempt to use the action input's diagnostic-endpoint option.

    // Note: we don't use actionsCore.getInput('diagnostic-endpoint') on purpose:
    // getInput silently converts absent data to an empty string.
    const providedDiagnosticEndpoint = process.env["INPUT_DIAGNOSTIC-ENDPOINT"];
    if (providedDiagnosticEndpoint === "") {
      // User probably explicitly turned it off
      return undefined;
    }

    if (providedDiagnosticEndpoint !== undefined) {
      try {
        return mungeDiagnosticEndpoint(new URL(providedDiagnosticEndpoint));
      } catch (e) {
        actionsCore.info(
          `User-provided diagnostic endpoint ignored: not a valid URL: ${e}`,
        );
      }
    }
  }

  try {
    const diagnosticUrl = new URL(IDS_HOST);
    diagnosticUrl.pathname += idsProjectName;
    diagnosticUrl.pathname += "/diagnostics";
    return diagnosticUrl;
  } catch (e) {
    actionsCore.info(
      `Generated diagnostic endpoint ignored: not a valid URL: ${e}`,
    );
  }

  return undefined;
}

function mungeDiagnosticEndpoint(inputUrl: URL): URL {
  if (DEFAULT_IDS_HOST === IDS_HOST) {
    return inputUrl;
  }

  try {
    const defaultIdsHost = new URL(DEFAULT_IDS_HOST);
    const currentIdsHost = new URL(IDS_HOST);

    if (inputUrl.origin !== defaultIdsHost.origin) {
      return inputUrl;
    }

    inputUrl.protocol = currentIdsHost.protocol;
    inputUrl.host = currentIdsHost.host;
    inputUrl.username = currentIdsHost.username;
    inputUrl.password = currentIdsHost.password;

    return inputUrl;
  } catch (e) {
    actionsCore.info(`Default or overridden IDS host isn't a valid URL: ${e}`);
  }

  return inputUrl;
}

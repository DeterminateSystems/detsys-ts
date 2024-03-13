import { createHash } from "node:crypto";
import * as actionsCore from "@actions/core";

export type AnonymizedCorrelationHashes = {
  correlation_source: string;
  repository?: string;
  run?: string;
  run_differentiator?: string;
  workflow?: string;
  groups: Record<string, string | undefined>;
};

export function identify(): AnonymizedCorrelationHashes {
  const ident = {
    correlation_source: "github-actions",

    repository: hashEnvironmentVariables([
      "GITHUB_SERVER_URL",
      "GITHUB_REPOSITORY_OWNER",
      "GITHUB_REPOSITORY_OWNER_ID",
      "GITHUB_REPOSITORY",
      "GITHUB_REPOSITORY_ID",
    ]),
    workflow: hashEnvironmentVariables([
      "GITHUB_SERVER_URL",
      "GITHUB_REPOSITORY_OWNER",
      "GITHUB_REPOSITORY_OWNER_ID",
      "GITHUB_REPOSITORY",
      "GITHUB_REPOSITORY_ID",
      "GITHUB_WORKFLOW",
    ]),
    run: hashEnvironmentVariables([
      "GITHUB_SERVER_URL",
      "GITHUB_REPOSITORY_OWNER",
      "GITHUB_REPOSITORY_OWNER_ID",
      "GITHUB_REPOSITORY",
      "GITHUB_REPOSITORY_ID",
      "GITHUB_RUN_ID",
    ]),
    run_differentiator: hashEnvironmentVariables([
      "GITHUB_SERVER_URL",
      "GITHUB_REPOSITORY_OWNER",
      "GITHUB_REPOSITORY_OWNER_ID",
      "GITHUB_REPOSITORY",
      "GITHUB_REPOSITORY_ID",
      "GITHUB_RUN_ID",
      "GITHUB_RUN_NUMBER",
      "GITHUB_RUN_ATTEMPT",
    ]),
    groups: {
      ci: "github-actions",
      github_organization: hashEnvironmentVariables([
        "GITHUB_SERVER_URL",
        "GITHUB_REPOSITORY_OWNER",
        "GITHUB_REPOSITORY_OWNER_ID",
      ]),
    },
  };

  actionsCore.debug("Correlation data:");
  actionsCore.debug(JSON.stringify(ident, null, 2));

  return ident;
}

function hashEnvironmentVariables(variables: string[]): undefined | string {
  const hash = createHash("sha256");

  for (const varName of variables) {
    const value = process.env[varName];
    if (value === undefined) {
      actionsCore.debug(
        `Environment variable not set: ${varName} -- can't generate the requested identity`,
      );
      return undefined;
    } else {
      hash.update(value);
      hash.update("\0");
    }
  }

  return hash.digest("hex");
}

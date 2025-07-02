import * as actionsCore from "@actions/core";
import { createHash, randomUUID } from "node:crypto";

const OPTIONAL_VARIABLES = ["INVOCATION_ID"];

/* eslint-disable camelcase */
/**
 * JSON sent to server.
 */
export type AnonymizedCorrelationHashes = {
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

export function identify(): AnonymizedCorrelationHashes {
  const repository = hashEnvironmentVariables("GHR", [
    "GITHUB_SERVER_URL",
    "GITHUB_REPOSITORY_OWNER",
    "GITHUB_REPOSITORY_OWNER_ID",
    "GITHUB_REPOSITORY",
    "GITHUB_REPOSITORY_ID",
  ]);

  const run_differentiator = hashEnvironmentVariables("GHWJA", [
    "GITHUB_SERVER_URL",
    "GITHUB_REPOSITORY_OWNER",
    "GITHUB_REPOSITORY_OWNER_ID",
    "GITHUB_REPOSITORY",
    "GITHUB_REPOSITORY_ID",
    "GITHUB_WORKFLOW",
    "GITHUB_JOB",
    "GITHUB_RUN_ID",
    "GITHUB_RUN_NUMBER",
    "GITHUB_RUN_ATTEMPT",
    "INVOCATION_ID",
  ]);

  const ident: AnonymizedCorrelationHashes = {
    $anon_distinct_id: process.env["RUNNER_TRACKING_ID"] || randomUUID(),

    correlation_source: "github-actions",

    github_repository_hash: repository,
    github_workflow_hash: hashEnvironmentVariables("GHW", [
      "GITHUB_SERVER_URL",
      "GITHUB_REPOSITORY_OWNER",
      "GITHUB_REPOSITORY_OWNER_ID",
      "GITHUB_REPOSITORY",
      "GITHUB_REPOSITORY_ID",
      "GITHUB_WORKFLOW",
    ]),
    github_workflow_job_hash: hashEnvironmentVariables("GHWJ", [
      "GITHUB_SERVER_URL",
      "GITHUB_REPOSITORY_OWNER",
      "GITHUB_REPOSITORY_OWNER_ID",
      "GITHUB_REPOSITORY",
      "GITHUB_REPOSITORY_ID",
      "GITHUB_WORKFLOW",
      "GITHUB_JOB",
    ]),
    github_workflow_run_hash: hashEnvironmentVariables("GHWJR", [
      "GITHUB_SERVER_URL",
      "GITHUB_REPOSITORY_OWNER",
      "GITHUB_REPOSITORY_OWNER_ID",
      "GITHUB_REPOSITORY",
      "GITHUB_REPOSITORY_ID",
      "GITHUB_WORKFLOW",
      "GITHUB_JOB",
      "GITHUB_RUN_ID",
    ]),
    github_workflow_run_differentiator_hash: run_differentiator,
    $session_id: run_differentiator,
    $groups: {
      github_repository: repository,
      github_organization: hashEnvironmentVariables("GHO", [
        "GITHUB_SERVER_URL",
        "GITHUB_REPOSITORY_OWNER",
        "GITHUB_REPOSITORY_OWNER_ID",
      ]),
    },
    is_ci: true,
  };

  actionsCore.debug("Correlation data:");
  actionsCore.debug(JSON.stringify(ident, null, 2));

  return ident;
}

function hashEnvironmentVariables(
  prefix: string,
  variables: string[],
): undefined | string {
  const hash = createHash("sha256");

  for (const varName of variables) {
    let value = process.env[varName];

    if (value === undefined) {
      if (OPTIONAL_VARIABLES.includes(varName)) {
        actionsCore.debug(
          `Optional environment variable not set: ${varName} -- substituting with the variable name`,
        );
        value = varName;
      } else {
        actionsCore.debug(
          `Environment variable not set: ${varName} -- can't generate the requested identity`,
        );
        return undefined;
      }
    }

    hash.update(value);
    hash.update("\0");
  }

  return `${prefix}-${hash.digest("hex")}`;
}

/**
 * @packageDocumentation
 * The OpenTelemetry `cicd.*` and `vcs.*` attributes of a GitHub Actions run.
 *
 * These are the standard names for a CI/CD run and the repository it builds.
 * They hold the values themselves, and not a hash of the values.
 * Thus a backend that knows nothing about Determinate Systems can read them.
 *
 * The correlation data in `./correlation.ts` stays hashed.
 * It has a different purpose: the check-in evaluates feature flags against it.
 */
import * as actionsGithub from "@actions/github";
import * as otelApi from "@opentelemetry/api";
import * as semconv from "@opentelemetry/semantic-conventions/incubating";

/**
 * The parts of the Actions toolkit's context that this module reads.
 *
 * The toolkit makes its context when you import it, from the environment and
 * from the event that GitHub wrote.
 */
export type GitHubContext = Pick<
  typeof actionsGithub.context,
  | "job"
  | "payload"
  | "ref"
  | "repo"
  | "runAttempt"
  | "runId"
  | "serverUrl"
  | "sha"
  | "workflow"
>;

/** The pull request in the event payload, as far as this module reads it. */
type PullRequest = {
  number: number;
  head?: { ref?: string; sha?: string };
  base?: { ref?: string; sha?: string };
};

/**
 * The `cicd.*` and `vcs.*` attributes of this run.
 *
 * Each attribute that the run does not supply is absent.
 * Only the provider is left when the program does not run in GitHub Actions.
 */
export function githubSemconvAttributes(
  context: GitHubContext = actionsGithub.context,
): otelApi.Attributes {
  const repository = repositoryOf(context);
  const pullRequest: PullRequest | undefined = context.payload.pull_request;

  // A pull request builds a merge commit that GitHub makes for the run. The
  // head of the change is the branch that asks for the merge.
  const head = pullRequest?.head;

  const attributes: Record<string, string | undefined> = {
    [semconv.ATTR_CICD_PIPELINE_NAME]: text(context.workflow),
    [semconv.ATTR_CICD_PIPELINE_RUN_ID]: numericString(context.runId),
    [semconv.ATTR_CICD_PIPELINE_RUN_URL_FULL]: pipelineRunUrl(
      context,
      repository,
    ),
    [semconv.ATTR_CICD_PIPELINE_TASK_NAME]: text(context.job),
    // The toolkit's context does not carry the name of the runner.
    [semconv.ATTR_CICD_WORKER_NAME]: text(process.env["RUNNER_NAME"]),

    [semconv.ATTR_VCS_PROVIDER_NAME]: semconv.VCS_PROVIDER_NAME_VALUE_GITHUB,
    [semconv.ATTR_VCS_OWNER_NAME]: repository?.owner,
    [semconv.ATTR_VCS_REPOSITORY_NAME]: repository?.repo,
    [semconv.ATTR_VCS_REPOSITORY_URL_FULL]: repositoryUrl(context, repository),

    // The name is the reference without `refs/heads/` or `refs/tags/` in
    // front. A pull request already gives the name of the head branch.
    [semconv.ATTR_VCS_REF_HEAD_NAME]: text(head?.ref) ?? refName(context.ref),
    [semconv.ATTR_VCS_REF_HEAD_TYPE]:
      head === undefined
        ? refType(text(context.ref))
        : semconv.VCS_REF_HEAD_TYPE_VALUE_BRANCH,
    [semconv.ATTR_VCS_REF_HEAD_REVISION]: text(head?.sha) ?? text(context.sha),

    [semconv.ATTR_VCS_REF_BASE_NAME]: text(pullRequest?.base?.ref),
    [semconv.ATTR_VCS_REF_BASE_TYPE]:
      pullRequest?.base?.ref === undefined
        ? undefined
        : semconv.VCS_REF_BASE_TYPE_VALUE_BRANCH,
    [semconv.ATTR_VCS_REF_BASE_REVISION]: text(pullRequest?.base?.sha),

    [semconv.ATTR_VCS_CHANGE_ID]: numericString(pullRequest?.number),
  };

  // An attribute with no value is not an attribute.
  return Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value !== undefined),
  );
}

/**
 * The ref the workflow pinned, when that ref names a version.
 *
 * `service.version` is the version of the service, such as `v3.1.0`, or the
 * revision that built it. A branch is not a version. It names whatever is
 * newest, thus two runs a month apart report the same value for different
 * code, and a question such as "did the new release do this" cannot be asked.
 *
 * A ref that is a branch therefore does not become `service.version`. It
 * stays on `detsys.github.action_ref`, which keeps every ref.
 *
 * @param ref - `$GITHUB_ACTION_REF`, which is what the workflow wrote in
 * `uses:` after the `@`.
 */
export function serviceVersionOf(ref: string | undefined): string | undefined {
  const value = text(ref);

  if (value === undefined) {
    return undefined;
  }

  // A tag such as `v3`, `v3.1`, or `3.1.0-rc1`, or the revision itself.
  const version = /^v?\d+(\.\d+)*([.-].+)?$/;
  const revision = /^[0-9a-f]{7,40}$/;

  return version.test(value) || revision.test(value) ? value : undefined;
}

/** The owner and the name of the repository, when the run names them. */
function repositoryOf(
  context: GitHubContext,
): { owner: string; repo: string } | undefined {
  try {
    // The toolkit throws when it cannot find the repository.
    const { owner, repo } = context.repo;

    return text(owner) === undefined || text(repo) === undefined
      ? undefined
      : { owner, repo };
  } catch {
    return undefined;
  }
}

/** The address of the repository in a browser. */
function repositoryUrl(
  context: GitHubContext,
  repository: { owner: string; repo: string } | undefined,
): string | undefined {
  if (repository === undefined) {
    return undefined;
  }

  const server = text(context.serverUrl)?.replace(/\/+$/, "");

  return server === undefined
    ? undefined
    : `${server}/${repository.owner}/${repository.repo}`;
}

/**
 * The address of this workflow run in a browser.
 *
 * The address names the attempt when the run is not the first attempt.
 * The first attempt is at the address of the run itself.
 */
function pipelineRunUrl(
  context: GitHubContext,
  repository: { owner: string; repo: string } | undefined,
): string | undefined {
  const url = repositoryUrl(context, repository);
  const runId = numericString(context.runId);

  if (url === undefined || runId === undefined) {
    return undefined;
  }

  const run = `${url}/actions/runs/${runId}`;
  const attempt = numericString(context.runAttempt);

  return attempt === undefined || attempt === "1"
    ? run
    : `${run}/attempts/${attempt}`;
}

/**
 * The bare name of a reference.
 *
 * A reference that is not a branch and not a tag keeps its full name.
 */
function refName(ref: string | undefined): string | undefined {
  return text(ref)?.replace(/^refs\/(heads|tags)\//, "");
}

/** Whether a reference is a branch or a tag. */
function refType(ref: string | undefined): string | undefined {
  if (ref?.startsWith("refs/heads/") === true) {
    return semconv.VCS_REF_HEAD_TYPE_VALUE_BRANCH;
  }

  if (ref?.startsWith("refs/tags/") === true) {
    return semconv.VCS_REF_HEAD_TYPE_VALUE_TAG;
  }

  return undefined;
}

/**
 * A value that the run supplies, or undefined.
 *
 * The toolkit says each of these is a string.
 * A run that does not set the variable makes it undefined all the same.
 */
function text(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value;
}

/**
 * A number as the conventions want it, which is text.
 *
 * The toolkit parses these, and gives NaN for a variable that is not set.
 */
function numericString(value: number | undefined): string | undefined {
  return value === undefined || !Number.isInteger(value)
    ? undefined
    : `${value}`;
}

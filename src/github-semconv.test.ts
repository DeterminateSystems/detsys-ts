import {
  type GitHubContext,
  githubSemconvAttributes,
} from "./github-semconv.js";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

const HEAD_SHA = "5aa9f9ba3b4d4dc4f4dcd5f0ba0f0e4a1d1b3c2e";
const MERGE_SHA = "1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d";
const BASE_SHA = "0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c";

/** A push to a branch, which is the plainest run there is. */
function pushToBranch(): GitHubContext {
  return {
    workflow: "CI",
    job: "build",
    runId: 58,
    runAttempt: 1,
    serverUrl: "https://github.com",
    repo: { owner: "DeterminateSystems", repo: "detsys-ts" },
    ref: "refs/heads/main",
    sha: HEAD_SHA,
    payload: {},
  };
}

/** A pull request, whose head is the branch that asks for the merge. */
function pullRequest(): GitHubContext {
  return {
    ...pushToBranch(),
    ref: "refs/pull/1075/merge",
    sha: MERGE_SHA,
    payload: {
      // GitHub names this key, and not us.
      // eslint-disable-next-line camelcase
      pull_request: {
        number: 1075,
        head: { ref: "my-feature-branch", sha: HEAD_SHA },
        base: { ref: "main", sha: BASE_SHA },
      },
    },
  };
}

describe("githubSemconvAttributes", () => {
  beforeEach(() => {
    process.env["RUNNER_NAME"] = "GitHub Actions 4";
  });

  afterEach(() => {
    delete process.env["RUNNER_NAME"];
  });

  test("describes a push to a branch", () => {
    expect(githubSemconvAttributes(pushToBranch())).toStrictEqual({
      "cicd.pipeline.name": "CI",
      "cicd.pipeline.run.id": "58",
      "cicd.pipeline.run.url.full":
        "https://github.com/DeterminateSystems/detsys-ts/actions/runs/58",
      "cicd.pipeline.task.name": "build",
      "cicd.worker.name": "GitHub Actions 4",
      "vcs.provider.name": "github",
      "vcs.owner.name": "DeterminateSystems",
      "vcs.repository.name": "detsys-ts",
      "vcs.repository.url.full":
        "https://github.com/DeterminateSystems/detsys-ts",
      "vcs.ref.head.name": "refs/heads/main",
      "vcs.ref.head.type": "branch",
      "vcs.ref.head.revision": HEAD_SHA,
    });
  });

  test("records the values themselves, and not a hash of them", () => {
    const attributes = githubSemconvAttributes(pushToBranch());

    expect(attributes["vcs.repository.name"]).toBe("detsys-ts");
    expect(attributes["cicd.pipeline.name"]).toBe("CI");
  });

  test("describes a pull request by its head, its base, and its number", () => {
    const attributes = githubSemconvAttributes(pullRequest());

    // The head is the branch that asks for the merge, and not the merge ref.
    expect(attributes["vcs.ref.head.name"]).toBe("my-feature-branch");
    expect(attributes["vcs.ref.head.type"]).toBe("branch");
    expect(attributes["vcs.ref.head.revision"]).toBe(HEAD_SHA);
    expect(attributes["vcs.ref.base.name"]).toBe("main");
    expect(attributes["vcs.ref.base.type"]).toBe("branch");
    expect(attributes["vcs.ref.base.revision"]).toBe(BASE_SHA);
    expect(attributes["vcs.change.id"]).toBe("1075");
  });

  test("takes the number of the change from the event", () => {
    const context = pullRequest();
    // The reference of the run says nothing about the change.
    context.ref = "refs/heads/main";

    expect(githubSemconvAttributes(context)["vcs.change.id"]).toBe("1075");
  });

  test("has no change when the event is not a pull request", () => {
    const attributes = githubSemconvAttributes(pushToBranch());

    expect(attributes).not.toHaveProperty("vcs.change.id");
    expect(attributes).not.toHaveProperty("vcs.ref.base.name");
  });

  test("describes a tag", () => {
    const context = pushToBranch();
    context.ref = "refs/tags/v2.0.0";

    const attributes = githubSemconvAttributes(context);

    // The reference is what the run gives, and not a name cut out of it.
    expect(attributes["vcs.ref.head.name"]).toBe("refs/tags/v2.0.0");
    expect(attributes["vcs.ref.head.type"]).toBe("tag");
  });

  test("names the attempt when the run is not the first attempt", () => {
    const context = pushToBranch();
    context.runAttempt = 3;

    expect(githubSemconvAttributes(context)["cicd.pipeline.run.url.full"]).toBe(
      "https://github.com/DeterminateSystems/detsys-ts/actions/runs/58/attempts/3",
    );
  });

  test("uses the server the workflow runs on", () => {
    const context = pushToBranch();
    context.serverUrl = "https://github.example.com/";

    const attributes = githubSemconvAttributes(context);

    expect(attributes["vcs.repository.url.full"]).toBe(
      "https://github.example.com/DeterminateSystems/detsys-ts",
    );
    expect(attributes["cicd.pipeline.run.url.full"]).toBe(
      "https://github.example.com/DeterminateSystems/detsys-ts/actions/runs/58",
    );
  });

  test("keeps only the provider outside of GitHub Actions", () => {
    delete process.env["RUNNER_NAME"];

    expect(
      githubSemconvAttributes({
        workflow: undefined as unknown as string,
        job: undefined as unknown as string,
        runId: NaN,
        runAttempt: NaN,
        serverUrl: "https://github.com",
        // The toolkit throws here when it cannot find the repository.
        get repo(): { owner: string; repo: string } {
          throw new Error("context.repo requires a GITHUB_REPOSITORY");
        },
        ref: undefined as unknown as string,
        sha: undefined as unknown as string,
        payload: {},
      }),
    ).toStrictEqual({ "vcs.provider.name": "github" });
  });
});

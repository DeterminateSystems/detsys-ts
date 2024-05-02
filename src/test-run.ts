import { IdsToolbox } from "./index.js";
import { Ok } from "./result.js";

process.env["RUNNER_ARCH"] = "ARM64";
process.env["RUNNER_OS"] = "macOS";
process.env["IDS_HOST"] = "http://localhost:8080";
process.env["INPUT_DIAGNOSTIC-ENDPOINT"] =
  "http://localhost:8080/nix-installer/diagnostic";
process.env["GITHUB_SERVER_URL"] = "my-github-server2";
process.env["GITHUB_REPOSITORY_OWNER"] = "owner";
process.env["GITHUB_REPOSITORY_OWNER_ID"] = "12";
process.env["GITHUB_REPOSITORY"] = "repo";
process.env["GITHUB_REPOSITORY_ID"] = "34";
process.env["GITHUB_WORKFLOW"] = "My Workflow";
process.env["GITHUB_RUN_ID"] = "58";
process.env["GITHUB_RUN_NUMBER"] = "78";
process.env["GITHUB_RUN_ATTEMPT"] = "1";

async function main(): Promise<void> {
  {
    const toolbox = IdsToolbox.create({
      name: "nix-installer",
      fetchStyle: "nix-style",
      requireNix: "warn",
      hookMain: async () => {
        toolbox.recordEvent("my_event");
        toolbox.recordEvent("my_next_event");
        await toolbox.fetch();
        return Ok(undefined);
      },
    }).unwrap();

    toolbox.execute();
  }

  {
    const toolbox = IdsToolbox.create({
      name: "magic-nix-cache",
      fetchStyle: "gh-env-style",
      requireNix: "warn",
      hookMain: async () => {
        toolbox.recordEvent("cache_hit");
        toolbox.recordEvent("cache_miss");
        return Ok(undefined);
      },
    }).unwrap();

    toolbox.execute();
  }
}

await main();

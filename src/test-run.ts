import { DetSysAction } from "./index.js";

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

class NixInstallerAction extends DetSysAction {
  async main(): Promise<void> {
    this.recordEvent("my_event");
    this.recordEvent("my_next_event");
    await this.fetchExecutable();
  }

  // biome-ignore lint/suspicious/noEmptyBlockStatements: testing
  async post(): Promise<void> {}
}

class MagicNixCacheAction extends DetSysAction {
  async main(): Promise<void> {
    this.recordEvent("cache_hit");
    this.recordEvent("cache_miss");
  }

  // biome-ignore lint/suspicious/noEmptyBlockStatements: testing
  async post(): Promise<void> {}
}

async function main(): Promise<void> {
  new NixInstallerAction({
    name: "nix-installer",
    fetchStyle: "nix-style",
    requireNix: "warn",
  }).execute();

  new MagicNixCacheAction({
    name: "magic-nix-cache",
    fetchStyle: "gh-env-style",
    requireNix: "warn",
  }).execute();
}

await main();

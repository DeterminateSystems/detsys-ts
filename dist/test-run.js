import { IdsToolbox } from "./main.js";
process.env["RUNNER_ARCH"] = "ARM64";
process.env["RUNNER_OS"] = "macOS";
process.env["IDS_HOST"] = "http://localhost:8080";
process.env["GITHUB_SERVER_URL"] = "my-github-server2";
process.env["GITHUB_REPOSITORY_OWNER"] = "owner";
process.env["GITHUB_REPOSITORY_OWNER_ID"] = "12";
process.env["GITHUB_REPOSITORY"] = "repo";
process.env["GITHUB_REPOSITORY_ID"] = "34";
process.env["GITHUB_WORKFLOW"] = "My Workflow";
process.env["GITHUB_RUN_ID"] = "58";
process.env["GITHUB_RUN_NUMBER"] = "78";
process.env["GITHUB_RUN_ATTEMPT"] = "1";
async function main() {
    {
        const toolbox = new IdsToolbox({
            name: "nix-installer",
            fetchStyle: "nix-style",
            requireNix: false,
        });
        toolbox.onMain(async () => {
            toolbox.recordEvent("my_event");
            toolbox.recordEvent("my_next_event");
            await toolbox.fetch();
        });
        toolbox.execute();
    }
    {
        const toolbox = new IdsToolbox({
            name: "magic-nix-cache",
            fetchStyle: "gh-env-style",
            requireNix: false,
        });
        toolbox.onMain(async () => {
            toolbox.recordEvent("cache_hit");
            toolbox.recordEvent("cache_miss");
        });
        toolbox.execute();
    }
}
await main();

/**
 * @packageDocumentation
 * Collects backtraces for executables for diagnostics
 */
import { isLinux, isMacOS } from "./actions-core-platform.js";
import { stringifyError } from "./errors.js";
import * as actionsCore from "@actions/core";
import * as exec from "@actions/exec";
import { readFile, readdir, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { gzip } from "node:zlib";

// Give a few seconds buffer, capturing traces that happened a few seconds earlier.
const START_SLOP_SECONDS = 5;

export async function collectBacktraces(
  prefixes: string[],
  programNameDenyList: string[],
  startTimestampMs: number,
): Promise<Map<string, string>> {
  if (isMacOS) {
    return await collectBacktracesMacOS(
      prefixes,
      programNameDenyList,
      startTimestampMs,
    );
  }
  if (isLinux) {
    return await collectBacktracesSystemd(
      prefixes,
      programNameDenyList,
      startTimestampMs,
    );
  }

  return new Map();
}

export async function collectBacktracesMacOS(
  prefixes: string[],
  programNameDenyList: string[],
  startTimestampMs: number,
): Promise<Map<string, string>> {
  const backtraces: Map<string, string> = new Map();

  try {
    const { stdout: logJson } = await exec.getExecOutput(
      "log",
      [
        "show",
        "--style",
        "json",
        "--last",
        // Note we collect the last 1m only, because it should only take a few seconds to write the crash log.
        // Therefore, any crashes before this 1m should be long done by now.
        "1m",
        "--no-info",
        "--predicate",
        "sender = 'ReportCrash'",
      ],
      {
        silent: true,
      },
    );

    const sussyArray: unknown = JSON.parse(logJson);
    if (!Array.isArray(sussyArray)) {
      throw new Error(`Log json isn't an array: ${logJson}`);
    }

    if (sussyArray.length > 0) {
      actionsCore.info(`Collecting crash data...`);
      const delay = async (ms: number): Promise<void> =>
        new Promise((resolve) => setTimeout(resolve, ms));
      await delay(5000);
    }
  } catch {
    actionsCore.debug(
      "Failed to check logs for in-progress crash dumps; now proceeding with the assumption that all crash dumps completed.",
    );
  }

  const dirs = [
    ["system", "/Library/Logs/DiagnosticReports/"],
    ["user", `${process.env["HOME"]}/Library/Logs/DiagnosticReports/`],
  ];

  for (const [source, dir] of dirs) {
    const fileNames = (await readdir(dir))
      .filter((fileName) => {
        return prefixes.some((prefix) => fileName.startsWith(prefix));
      })
      .filter((fileName) => {
        return !programNameDenyList.some((programName) =>
          // Sometimes the files are like `nix-expr-tests_Y-m-d`
          fileName.startsWith(`${programName}_${new Date().getFullYear()}`),
        );
      })
      .filter((fileName) => {
        return !programNameDenyList.some((programName) =>
          // Sometimes the files are like `nix-expr-tests-Y-m-d`
          fileName.startsWith(`${programName}-${new Date().getFullYear()}`),
        );
      })
      .filter((fileName) => {
        // macOS creates .diag files periodically, which are called "microstackshots".
        // We don't necessarily want those, and they're definitely not crashes.
        // See: https://patents.google.com/patent/US20140237219A1/en
        return !fileName.endsWith(".diag");
      });

    const doGzip = promisify(gzip);
    for (const fileName of fileNames) {
      try {
        if ((await stat(`${dir}/${fileName}`)).ctimeMs >= startTimestampMs) {
          const logText = await readFile(`${dir}/${fileName}`);
          const buf = await doGzip(logText);
          backtraces.set(
            `backtrace_value_${source}_${fileName}`,
            buf.toString("base64"),
          );
        }
      } catch (innerError: unknown) {
        backtraces.set(
          `backtrace_failure_${source}_${fileName}`,
          stringifyError(innerError),
        );
      }
    }
  }

  return backtraces;
}

type SystemdCoreDumpInfo = {
  exe: string;
  pid: number;
};

export async function collectBacktracesSystemd(
  prefixes: string[],
  programNameDenyList: string[],
  startTimestampMs: number,
): Promise<Map<string, string>> {
  const sinceSeconds =
    Math.ceil((Date.now() - startTimestampMs) / 1000) + START_SLOP_SECONDS;
  const backtraces: Map<string, string> = new Map();

  const coredumps: SystemdCoreDumpInfo[] = [];

  try {
    const { stdout: coredumpjson } = await exec.getExecOutput(
      "coredumpctl",
      ["--json=pretty", "list", "--since", `${sinceSeconds} seconds ago`],
      {
        silent: true,
      },
    );

    const sussyArray: unknown = JSON.parse(coredumpjson);
    if (!Array.isArray(sussyArray)) {
      throw new Error(`Coredump isn't an array: ${coredumpjson}`);
    }

    for (const sussyObject of sussyArray) {
      const keys = Object.keys(sussyObject);

      if (keys.includes("exe") && keys.includes("pid")) {
        if (
          typeof sussyObject.exe == "string" &&
          typeof sussyObject.pid == "number"
        ) {
          const execParts = sussyObject.exe.split("/");
          const binaryName = execParts[execParts.length - 1];

          if (
            prefixes.some((prefix) => binaryName.startsWith(prefix)) &&
            !programNameDenyList.includes(binaryName)
          ) {
            coredumps.push({
              exe: sussyObject.exe,
              pid: sussyObject.pid,
            });
          }
        } else {
          actionsCore.debug(
            `Mysterious coredump entry missing exe string and/or pid number: ${JSON.stringify(sussyObject)}`,
          );
        }
      } else {
        actionsCore.debug(
          `Mysterious coredump entry missing exe value and/or pid value: ${JSON.stringify(sussyObject)}`,
        );
      }
    }
  } catch (innerError: unknown) {
    actionsCore.debug(
      `Cannot collect backtraces: ${stringifyError(innerError)}`,
    );

    return backtraces;
  }

  const doGzip = promisify(gzip);
  for (const coredump of coredumps) {
    try {
      const { stdout: logText } = await exec.getExecOutput(
        "coredumpctl",
        ["info", `${coredump.pid}`],
        {
          silent: true,
        },
      );

      const buf = await doGzip(logText);
      backtraces.set(`backtrace_value_${coredump.pid}`, buf.toString("base64"));
    } catch (innerError: unknown) {
      backtraces.set(
        `backtrace_failure_${coredump.pid}`,
        stringifyError(innerError),
      );
    }
  }

  return backtraces;
}

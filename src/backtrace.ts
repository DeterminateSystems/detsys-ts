/**
 * @packageDocumentation
 * Collects backtraces for executables for diagnostics
 */
import { isLinux, isMacOS } from "./actions-core-platform.js";
import { stringifyError } from "./errors.js";
import * as actionsCore from "@actions/core";
import * as exec from "@actions/exec";
import { readFile, readdir, stat } from "node:fs/promises";

// Give a few seconds buffer, capturing traces that happened a few seconds earlier.
const START_SLOP_SECONDS = 5;

/**
 * One crash of one program, as the operating system recorded it.
 *
 * Exactly one of `report` and `error` is set: either we read the crash report
 * or we can say why we could not.
 */
export type Backtrace = {
  /** Identifies the crash: the report's file name on macOS, the PID on Linux. */
  id: string;

  /** Where the report came from: `system`, `user`, or `coredumpctl`. */
  source: string;

  /** The program that crashed, when the operating system names it. */
  program?: string;

  /** The crash report itself. */
  report?: string;

  /** Why the crash report could not be read. */
  error?: string;
};

export async function collectBacktraces(
  prefixes: string[],
  programNameDenyList: string[],
  startTimestampMs: number,
): Promise<Backtrace[]> {
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

  return [];
}

export async function collectBacktracesMacOS(
  prefixes: string[],
  programNameDenyList: string[],
  startTimestampMs: number,
): Promise<Backtrace[]> {
  const backtraces: Backtrace[] = [];

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
          fileName.startsWith(programName),
        );
      })
      .filter((fileName) => {
        // macOS creates .diag files periodically, which are called "microstackshots".
        // We don't necessarily want those, and they're definitely not crashes.
        // See: https://patents.google.com/patent/US20140237219A1/en
        return !fileName.endsWith(".diag");
      });

    for (const fileName of fileNames) {
      try {
        if ((await stat(`${dir}/${fileName}`)).ctimeMs >= startTimestampMs) {
          backtraces.push({
            id: fileName,
            source,
            report: await readFile(`${dir}/${fileName}`, "utf-8"),
          });
        }
      } catch (innerError: unknown) {
        backtraces.push({
          id: fileName,
          source,
          error: stringifyError(innerError),
        });
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
): Promise<Backtrace[]> {
  const sinceSeconds =
    Math.ceil((Date.now() - startTimestampMs) / 1000) + START_SLOP_SECONDS;
  const backtraces: Backtrace[] = [];

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

  for (const coredump of coredumps) {
    try {
      const { stdout: report } = await exec.getExecOutput(
        "coredumpctl",
        ["info", `${coredump.pid}`],
        {
          silent: true,
        },
      );

      backtraces.push({
        id: `${coredump.pid}`,
        source: "coredumpctl",
        program: coredump.exe,
        report,
      });
    } catch (innerError: unknown) {
      backtraces.push({
        id: `${coredump.pid}`,
        source: "coredumpctl",
        program: coredump.exe,
        error: stringifyError(innerError),
      });
    }
  }

  return backtraces;
}

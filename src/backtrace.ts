/**
 * @packageDocumentation
 * Collects backtraces for executables for diagnostics
 */
import { stringifyError } from "./errors.js";
import * as actionsCore from "@actions/core";
import * as exec from "@actions/exec";
import { readFile, readdir } from "node:fs/promises";
import { promisify } from "node:util";
import { gzip } from "node:zlib";
import os from "os";

export async function collectBacktraces(
  prefixes: string[],
): Promise<Map<string, string>> {
  if (os.platform() === "darwin") {
    return await collectBacktracesMacOS(prefixes);
  }
  if (os.platform() === "linux") {
    return await collectBacktracesSystemd(prefixes);
  }

  return new Map();
}

export async function collectBacktracesMacOS(
  prefixes: string[],
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
        // Therefor, any crashes before this 1m should be long done by now.
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
  } catch (e: unknown) {
    actionsCore.debug(
      "Failed to check logs for in-progress crash dumps, assuming there are none.",
    );
  }

  const dirs = [
    ["system", "/Library/Logs/DiagnosticReports/"],
    ["user", `${process.env["HOME"]}/Library/Logs/DiagnosticReports/`],
  ];

  for (const [source, dir] of dirs) {
    const fileNames = (await readdir(dir)).filter((fileName) => {
      return prefixes.some((prefix) => fileName.startsWith(prefix));
    });

    const doGzip = promisify(gzip);
    for (const fileName of fileNames) {
      try {
        const logText = await readFile(`${dir}/${fileName}`);
        const buf = await doGzip(logText);
        backtraces.set(
          `backtrace_value_${source}_${fileName}`,
          buf.toString("base64"),
        );
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

interface SystemdCoreDumpInfo {
  exe: string;
  pid: number;
}

export async function collectBacktracesSystemd(
  prefixes: string[],
): Promise<Map<string, string>> {
  const backtraces: Map<string, string> = new Map();

  const coredumps: SystemdCoreDumpInfo[] = [];

  try {
    const { stdout: coredumpjson } = await exec.getExecOutput(
      "coredumpctl",
      ["--json=pretty", "list", "--since", "1 hour ago"],
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

          if (prefixes.some((prefix) => binaryName.startsWith(prefix))) {
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

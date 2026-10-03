import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { createRegistry, lint, resolveConfig } from "@stcn100/core";
import { builtinPlugin } from "@stcn100/rules";
import { loadConfig } from "./config-loader.js";
import { collectFiles } from "./file-collector.js";
import { formatJson, formatText, type FileReport } from "./reporters.js";

const HELP = `stcn100 - Simplified Technical Chinese linter

Usage:
  stcn100 [lint] [files...] [options]
  stcn100 rules
  stcn100 init

Options:
  -c, --config <path>       Config file path
  -p, --profile <names>     Comma-separated presets, such as general,coding
  -f, --format <format>     text or json
      --fix                 Apply safe fixes
      --max-warnings <n>    Exit with code 1 when warnings exceed n
  -q, --quiet               Show errors only
  -h, --help                Show help
  -v, --version             Show version
`;

const PACKAGE_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  }
).version;

interface CliValues {
  config?: string;
  profile?: string[];
  format: string;
  fix: boolean;
  "max-warnings"?: string;
  quiet: boolean;
  help: boolean;
  version: boolean;
}

interface ParsedCli {
  values: CliValues;
  positionals: string[];
}

const STARTER_CONFIG = {
  extends: ["general", "coding"],
  rules: {
    "sentence-length": ["warning", { suggestedMax: 30, hardMax: 40 }],
    terminology: [
      "warning",
      {
        terms: [
          {
            preferred: "配置",
            aliases: ["设定"]
          }
        ]
      }
    ]
  }
};

function fail(message: string): number {
  process.stderr.write(`${message}\n`);
  return 2;
}

function commandArguments(positionals: string[]): { command: string; files: string[] } {
  const first = positionals[0];
  if (first === "lint" || first === "rules" || first === "init") {
    return { command: first, files: positionals.slice(1) };
  }
  return { command: "lint", files: positionals };
}

function printRules(): void {
  const rows = builtinPlugin.rules
    ?.map(
      (rule) =>
        `${rule.meta.id.padEnd(34)} ${(rule.meta.confidence ?? "heuristic").padEnd(13)} ${(rule.meta.fixable ? "fix" : "---").padEnd(3)} ${rule.meta.description}`
    )
    .sort();
  process.stdout.write(`RULE${" ".repeat(30)} CONFIDENCE    FIX DESCRIPTION\n`);
  process.stdout.write(`${rows?.join("\n") ?? ""}\n`);
}

async function initConfig(cwd: string): Promise<number> {
  const configPath = path.join(cwd, "stcn100.config.json");
  try {
    await readFile(configPath, "utf8");
    return fail(`Config already exists: ${configPath}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  await writeFile(configPath, `${JSON.stringify(STARTER_CONFIG, null, 2)}\n`, "utf8");
  process.stdout.write(`Created ${configPath}\n`);
  return 0;
}

export async function runCli(argv = process.argv.slice(2), cwd = process.cwd()): Promise<number> {
  let parsed: ParsedCli;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        config: { type: "string", short: "c" },
        profile: { type: "string", short: "p", multiple: true },
        format: { type: "string", short: "f", default: "text" },
        fix: { type: "boolean", default: false },
        "max-warnings": { type: "string" },
        quiet: { type: "boolean", short: "q", default: false },
        help: { type: "boolean", short: "h", default: false },
        version: { type: "boolean", short: "v", default: false }
      }
    }) as ParsedCli;
  } catch (error) {
    return fail((error as Error).message);
  }

  if (parsed.values.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (parsed.values.version) {
    process.stdout.write(`${PACKAGE_VERSION}\n`);
    return 0;
  }

  const { command, files } = commandArguments(parsed.positionals);
  if (command === "rules") {
    printRules();
    return 0;
  }
  if (command === "init") {
    return initConfig(cwd);
  }

  const format = parsed.values.format;
  if (format !== "text" && format !== "json") {
    return fail(`Unknown format: ${format}`);
  }

  const rawMaxWarnings = parsed.values["max-warnings"];
  if (rawMaxWarnings !== undefined && !/^\d+$/.test(rawMaxWarnings)) {
    return fail(`Invalid max warnings: ${rawMaxWarnings}`);
  }
  const maxWarnings = rawMaxWarnings === undefined
    ? Number.POSITIVE_INFINITY
    : Number(rawMaxWarnings);

  const loaded = await loadConfig(cwd, parsed.values.config);
  const profileNames = parsed.values.profile
    ?.flatMap((value) => value.split(/[,\s]+/))
    .map((name) => name.trim())
    .filter(Boolean);
  const config = profileNames && profileNames.length > 0
    ? { ...loaded.config, extends: profileNames }
    : loaded.config;

  const registry = createRegistry([builtinPlugin]);
  const resolved = resolveConfig(config, registry);
  const filePaths = await collectFiles(files, cwd, resolved.ignore);
  if (filePaths.length === 0) {
    process.stderr.write("No input files found.\n");
    return 0;
  }

  const reports: FileReport[] = [];
  for (const filePath of filePaths) {
    const source = await readFile(filePath, "utf8");
    const result = lint({ filePath, source, config: resolved, registry, fix: parsed.values.fix });
    if (parsed.values.fix && result.output !== source) {
      await writeFile(filePath, result.output, "utf8");
    }
    reports.push({ filePath, diagnostics: result.diagnostics });
  }

  const visibleReports = parsed.values.quiet
    ? reports.map((report) => ({
        ...report,
        diagnostics: report.diagnostics.filter((diagnostic) => diagnostic.severity === "error")
      }))
    : reports;
  process.stdout.write(format === "json" ? formatJson(visibleReports) : formatText(visibleReports, cwd));

  const errors = reports.reduce(
    (total, report) => total + report.diagnostics.filter((item) => item.severity === "error").length,
    0
  );
  const warnings = reports.reduce(
    (total, report) => total + report.diagnostics.filter((item) => item.severity === "warning").length,
    0
  );
  return errors > 0 || warnings > maxWarnings ? 1 : 0;
}

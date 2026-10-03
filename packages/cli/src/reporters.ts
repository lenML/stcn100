import path from "node:path";
import type { Diagnostic } from "@stcn100/core";

export interface FileReport {
  filePath: string;
  diagnostics: Diagnostic[];
}

export interface ReportSummary {
  errors: number;
  warnings: number;
  infos: number;
  files: number;
}

function relativePath(filePath: string, cwd: string): string {
  const relative = path.relative(cwd, filePath);
  return relative.startsWith("..") ? filePath : relative;
}

export function summarize(reports: FileReport[]): ReportSummary {
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const report of reports) {
    for (const diagnostic of report.diagnostics) {
      if (diagnostic.severity === "error") {
        errors += 1;
      } else if (diagnostic.severity === "warning") {
        warnings += 1;
      } else {
        infos += 1;
      }
    }
  }

  return { errors, warnings, infos, files: reports.length };
}

export function formatText(reports: FileReport[], cwd: string): string {
  const lines: string[] = [];

  for (const report of reports) {
    if (report.diagnostics.length === 0) {
      continue;
    }
    lines.push(relativePath(report.filePath, cwd));
    for (const diagnostic of report.diagnostics) {
      lines.push(
        `  ${diagnostic.loc.start.line}:${diagnostic.loc.start.column}  ${diagnostic.severity.padEnd(7)}  ${diagnostic.confidence.padEnd(13)}  ${diagnostic.message}  ${diagnostic.ruleId}`
      );
    }
    lines.push("");
  }

  const summary = summarize(reports);
  lines.push(
    `${summary.files} files, ${summary.errors} errors, ${summary.warnings} warnings, ${summary.infos} infos`
  );
  return `${lines.join("\n")}\n`;
}

export function formatJson(reports: FileReport[]): string {
  return `${JSON.stringify({ summary: summarize(reports), reports }, null, 2)}\n`;
}

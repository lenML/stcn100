import { parseDocument } from "./parser.js";
import { locationAt } from "./text.js";
import type {
  Diagnostic,
  Document,
  ResolvedConfig,
  RuleContext,
  RuleModule,
  RuleRegistry
} from "./types.js";

export interface LintOptions {
  filePath: string;
  source: string;
  config: ResolvedConfig;
  registry: RuleRegistry;
  fix?: boolean;
}

export interface LintResult {
  diagnostics: Diagnostic[];
  output: string;
  fixed: boolean;
}

function lintDocument(document: Document, config: ResolvedConfig, registry: RuleRegistry): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const [ruleId, setting] of Object.entries(config.rules)) {
    const severity = setting.severity;
    if (severity === "off") {
      continue;
    }

    const rule = registry.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    const context: RuleContext = {
      filePath: document.filePath,
      report(report): void {
        const start = report.block.range[0] + report.start;
        const end = report.block.range[0] + report.end;
        const fix = report.fix
          ? {
              range: [
                report.block.range[0] + report.fix.range[0],
                report.block.range[0] + report.fix.range[1]
              ] as [number, number],
              text: report.fix.text
            }
          : undefined;

        const diagnostic: Diagnostic = {
          ruleId,
          severity,
          message: report.message,
          filePath: document.filePath,
          loc: locationAt(document.source, start, end, document.lineStarts)
        };

        if (fix) {
          diagnostic.fix = fix;
        }
        if (report.data) {
          diagnostic.data = report.data;
        }

        diagnostics.push(diagnostic);
      }
    };

    (rule as RuleModule<unknown>).check(document, setting.options, context);
  }

  return diagnostics.sort((left, right) => {
    return (
      left.loc.start.offset - right.loc.start.offset ||
      left.ruleId.localeCompare(right.ruleId)
    );
  });
}

function fixDiagnostics(source: string, diagnostics: Diagnostic[]): { output: string; applied: number } {
  const fixes = diagnostics
    .filter((diagnostic): diagnostic is Diagnostic & { fix: NonNullable<Diagnostic["fix"]> } => {
      return diagnostic.fix !== undefined;
    })
    .sort((left, right) => left.fix.range[0] - right.fix.range[0] || left.fix.range[1] - right.fix.range[1]);

  const accepted: NonNullable<Diagnostic["fix"]>[] = [];
  let previousEnd = -1;
  for (const fix of fixes.map((diagnostic) => diagnostic.fix)) {
    if (
      fix.range[0] < 0 ||
      fix.range[0] < previousEnd ||
      fix.range[0] > fix.range[1] ||
      fix.range[1] > source.length
    ) {
      continue;
    }
    accepted.push(fix);
    previousEnd = fix.range[1];
  }

  let output = source;
  for (const fix of accepted.sort((left, right) => right.range[0] - left.range[0])) {
    output = output.slice(0, fix.range[0]) + fix.text + output.slice(fix.range[1]);
  }

  return { output, applied: accepted.length };
}

export function lint(options: LintOptions): LintResult {
  let source = options.source;
  let document = parseDocument(options.filePath, source);
  let diagnostics = lintDocument(document, options.config, options.registry);
  let fixed = false;

  for (let pass = 0; options.fix && pass < 10; pass += 1) {
    const result = fixDiagnostics(source, diagnostics);
    if (result.applied === 0 || result.output === source) {
      break;
    }
    fixed = true;
    source = result.output;
    document = parseDocument(options.filePath, source);
    diagnostics = lintDocument(document, options.config, options.registry);
  }

  return { diagnostics, output: source, fixed };
}

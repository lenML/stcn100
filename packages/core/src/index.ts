export { createRegistry, defineConfig, definePlugin, defineRule, resolveConfig } from "./config.js";
export { lint } from "./engine.js";
export type { LintOptions, LintResult } from "./engine.js";
export { parseDocument } from "./parser.js";
export {
  countReadableUnits,
  findMatches,
  findTermMatches,
  getLineStarts,
  locationAt,
  positionAt
} from "./text.js";
export type { RegexMatch } from "./text.js";
export type {
  BlockKind,
  Diagnostic,
  DiagnosticFix,
  Document,
  Location,
  Plugin,
  Position,
  Preset,
  ResolvedConfig,
  ResolvedRuleSetting,
  RuleContext,
  RuleFix,
  RuleMeta,
  RuleModule,
  RuleRegistry,
  RuleReport,
  RuleSettingInput,
  Severity,
  SeveritySetting,
  StcnConfig,
  TextBlock
} from "./types.js";

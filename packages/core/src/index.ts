export { createRegistry, defineConfig, definePlugin, defineRule, resolveConfig } from "./config.js";
export { lint } from "./engine.js";
export type { LintOptions, LintResult } from "./engine.js";
export { parseDocument } from "./parser.js";
export { defaultTokenizer, IntlWordTokenizer } from "./tokenizer.js";
export {
  countReadableUnits,
  findMatches,
  findTermMatches,
  getLineStarts,
  joinChineseLines,
  locationAt,
  positionAt
} from "./text.js";
export type { RegexMatch } from "./text.js";
export type {
  BlockKind,
  Confidence,
  Diagnostic,
  DiagnosticFix,
  Document,
  HardWrap,
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
  TextBlock,
  Token,
  Tokenizer
} from "./types.js";

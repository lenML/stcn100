export type Severity = "off" | "info" | "warning" | "error";

export type Confidence = "deterministic" | "heuristic" | "semantic";

export interface Token {
  text: string;
  start: number;
  end: number;
  kind: "word" | "number" | "punctuation" | "space" | "symbol";
  pos?: string;
}

export interface Tokenizer {
  name: string;
  tokenize(text: string): Token[];
}

export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface Location {
  start: Position;
  end: Position;
}

export interface RuleFix {
  range: [start: number, end: number];
  text: string;
}

export interface DiagnosticFix extends RuleFix {
  description?: string;
}

export interface Diagnostic {
  ruleId: string;
  severity: Exclude<Severity, "off">;
  message: string;
  filePath: string;
  confidence: Confidence;
  loc: Location;
  fix?: DiagnosticFix;
  data?: Record<string, unknown>;
}

export type BlockKind =
  | "heading"
  | "paragraph"
  | "list-item"
  | "blockquote"
  | "table"
  | "plain";

export interface TextBlock {
  kind: BlockKind;
  text: string;
  analysisText: string;
  range: [start: number, end: number];
  loc: Location;
}

export interface Document {
  filePath: string;
  source: string;
  sourceType: "markdown" | "text";
  lineStarts: number[];
  blocks: TextBlock[];
  hardWraps: HardWrap[];
  disabledLines: number[];
}

export interface HardWrap {
  range: [start: number, end: number];
  startLine: number;
  endLine: number;
}

export interface RuleMeta {
  id: string;
  description: string;
  category: "clarity" | "consistency" | "structure" | "punctuation";
  confidence?: Confidence;
  fixable?: boolean;
  docs?: string;
}

export interface RuleReport {
  block: TextBlock;
  start: number;
  end: number;
  message: string;
  fix?: RuleFix;
  data?: Record<string, unknown>;
}

export interface RuleContext {
  filePath: string;
  tokenize(text: string): Token[];
  report(report: RuleReport): void;
}

export interface RuleModule<TOptions = unknown> {
  meta: RuleMeta;
  check(document: Document, options: TOptions, context: RuleContext): void;
}

export type SeveritySetting = Severity;
export type RuleSettingInput =
  | SeveritySetting
  | [severity: SeveritySetting, options: unknown];

export interface ResolvedRuleSetting {
  severity: Severity;
  options?: unknown;
}

export interface Preset {
  name: string;
  extends?: string[];
  rules: Record<string, RuleSettingInput | undefined>;
  ignore?: string[];
}

export interface Plugin {
  name: string;
  rules?: RuleModule<any>[];
  presets?: Record<string, Preset>;
}

export interface RuleRegistry {
  rules: Map<string, RuleModule<any>>;
  presets: Map<string, Preset>;
}

export interface StcnConfig {
  extends?: string | string[];
  rules?: Record<string, RuleSettingInput | undefined>;
  ignore?: string[];
}

export interface ResolvedConfig {
  rules: Record<string, ResolvedRuleSetting>;
  ignore: string[];
}

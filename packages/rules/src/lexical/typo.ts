import { defineRule } from "@stcn100/core";
import { findReplacementMatches, type ReplacementEntry } from "../utils/replacements.js";

export interface TypoEntry {
  term: string;
  replacement: string;
  message?: string;
}

export interface TypoOptions {
  terms?: TypoEntry[];
}

export const DEFAULT_TYPO_TERMS: TypoEntry[] = [
  { term: "阀值", replacement: "阈值" },
  { term: "布署", replacement: "部署" },
  { term: "反回", replacement: "返回" },
  { term: "回朔", replacement: "回溯" },
  { term: "做为", replacement: "作为" },
  { term: "embeding", replacement: "embedding" },
  { term: "提示工程学", replacement: "提示工程" }
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function entries(items: TypoEntry[]): ReplacementEntry[] {
  return items.map((item) => ({
    pattern: /^[A-Za-z]/u.test(item.term)
      ? new RegExp(`(?<![A-Za-z0-9_])${escapeRegExp(item.term)}(?![A-Za-z0-9_])`, "gu")
      : new RegExp(escapeRegExp(item.term), "gu"),
    replacement: item.replacement,
    ...(item.message ? { message: item.message } : {})
  }));
}

export const typoRule = defineRule<TypoOptions>({
  meta: {
    id: "typo",
    description: "检查高置信度中文技术文案错词。",
    category: "consistency",
    confidence: "deterministic",
    fixable: true
  },
  check(document, options, context): void {
    for (const block of document.blocks) {
      for (const match of findReplacementMatches(block.analysisText, entries(options.terms ?? DEFAULT_TYPO_TERMS))) {
        context.report({
          block,
          start: match.start,
          end: match.end,
          message: match.message ?? `错词“${match.value}”。改为“${match.replacement}”。`,
          fix: {
            range: [match.start, match.end],
            text: match.replacement
          },
          data: { replacement: match.replacement }
        });
      }
    }
  }
});

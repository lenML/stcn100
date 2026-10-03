import { defineRule } from "@stcn100/core";
import { findReplacementMatches, type ReplacementEntry } from "../utils/replacements.js";

const ENTRIES: ReplacementEntry[] = [
  { pattern: /\.{3,}/gu, replacement: "……", message: "中文省略号使用“……”。" },
  { pattern: /-{2,}(?![A-Za-z])/gu, replacement: "——", message: "中文破折号使用“——”。" },
  { pattern: /(?<=[\p{Script=Han}]),|,(?=[\p{Script=Han}])/gu, replacement: "，", message: "中文正文逗号使用全角“，”。" },
  { pattern: /(?<=[\p{Script=Han}]);|;(?=[\p{Script=Han}])/gu, replacement: "；", message: "中文正文分号使用全角“；”。" },
  { pattern: /(?<=[\p{Script=Han}]):|:(?=[\p{Script=Han}])/gu, replacement: "：", message: "中文正文冒号使用全角“：”。" },
  { pattern: /(?<=[\p{Script=Han}])\?|\?(?=[\p{Script=Han}])/gu, replacement: "？", message: "中文正文问号使用全角“？”。" },
  { pattern: /(?<=[\p{Script=Han}])!|!(?=[\p{Script=Han}])/gu, replacement: "！", message: "中文正文叹号使用全角“！”。" },
  { pattern: /(?<=[\p{Script=Han}])\.(?=[\p{Script=Han}])/gu, replacement: "。", message: "中文正文句号使用全角“。”。" },
  {
    pattern: /\(([^()\n]*\p{Script=Han}[^()\n]*)\)/gu,
    replacement: (match) => `（${match[1] ?? ""}）`,
    message: "中文正文括号使用全角“（）”。"
  }
];

export const punctuationStyleRule = defineRule({
  meta: {
    id: "punctuation-style",
    description: "统一中文正文中的省略号、破折号和标点宽度。",
    category: "punctuation",
    confidence: "deterministic",
    fixable: true
  },
  check(document, _options, context): void {
    for (const block of document.blocks) {
      for (const match of findReplacementMatches(block.analysisText, ENTRIES)) {
        context.report({
          block,
          start: match.start,
          end: match.end,
          message: match.message ?? "统一中文标点。",
          fix: {
            range: [match.start, match.end],
            text: match.replacement
          }
        });
      }
    }
  }
});

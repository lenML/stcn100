import { defineRule, findMatches } from "@stcn100/core";
import { findReplacementMatches, type ReplacementEntry } from "../utils/replacements.js";


const NUMERIC_ENTRIES: ReplacementEntry[] = [
  {
    pattern: new RegExp(`([0-9](?:[0-9.,]*[0-9])?)\\s*(GB|MB|KB|TB|ms|kg|km|cm|mm|MHz|GHz|kHz|Hz)\\b`, "gu"),
    replacement: (match) => `${match[1] ?? ""} ${match[2] ?? ""}`,
    message: "数值和单位之间留一个半角空格。"
  },
  {
    pattern: new RegExp(`([0-9](?:[0-9.,]*[0-9])?)\\s*°\\s*C\\b`, "gu"),
    replacement: (match) => `${match[1] ?? ""} °C`,
    message: "摄氏度单位写作“°C”，数值与单位之间留空格。"
  },
  {
    pattern: /([0-9](?:[0-9.,]*[0-9])?)\s+%/gu,
    replacement: (match) => `${match[1] ?? ""}%`,
    message: "百分号紧邻数值。"
  },
  {
    pattern: /([0-9](?:[0-9.,]*[0-9])?)\s+°(?!C)/gu,
    replacement: (match) => `${match[1] ?? ""}°`,
    message: "角度符号紧邻数值。"
  },
  {
    pattern: /\b([0-9]{2})\s*:\s*([0-9]{2})\b/gu,
    replacement: (match) => `${match[1] ?? ""}:${match[2] ?? ""}`,
    message: "时间内部不加空格。"
  }
];

export const numericSpacingRule = defineRule({
  meta: {
    id: "numeric-spacing",
    description: "规范数值、单位、百分比、角度和时间间距。",
    category: "punctuation",
    confidence: "deterministic",
    fixable: true
  },
  check(document, _options, context): void {
    for (const block of document.blocks) {
      for (const match of findReplacementMatches(block.analysisText, NUMERIC_ENTRIES)) {
        context.report({
          block,
          start: match.start,
          end: match.end,
          message: match.message ?? "统一数值格式。",
          fix: {
            range: [match.start, match.end],
            text: match.replacement
          }
        });
      }
    }
  }
});

import { defineRule, findMatches } from "@stcn100/core";

interface InsertionRule {
  pattern: RegExp;
  message: string;
}

const INSERTIONS: InsertionRule[] = [
  {
    pattern: /[\p{Script=Han}](?=[A-Za-z0-9])/gu,
    message: "中文与英文或数字之间加一个半角空格。"
  },
  {
    pattern: /[A-Za-z0-9](?=[\p{Script=Han}])/gu,
    message: "英文或数字与中文之间加一个半角空格。"
  }
];

export const cjkLatinSpacingRule = defineRule({
  meta: {
    id: "cjk-latin-spacing",
    description: "规范可见正文中的中西文留白。",
    category: "punctuation",
    confidence: "deterministic",
    fixable: true
  },
  check(document, _options, context): void {
    for (const block of document.blocks) {
      for (const rule of INSERTIONS) {
        for (const match of findMatches(block.analysisText, rule.pattern)) {
          context.report({
            block,
            start: match.end,
            end: match.end,
            message: rule.message,
            fix: {
              range: [match.end, match.end],
              text: " "
            }
          });
        }
      }

      for (const match of findMatches(block.analysisText, / +([，。；：！？、）】》」])/gu)) {
        context.report({
          block,
          start: match.start,
          end: match.end,
          message: "全角标点前不加空格。",
          fix: {
            range: [match.start, match.end],
            text: match.value.trimStart()
          }
        });
      }

      for (const match of findMatches(block.analysisText, /([（【《「]) +/gu)) {
        context.report({
          block,
          start: match.start,
          end: match.end,
          message: "全角标点后不加空格。",
          fix: {
            range: [match.start, match.end],
            text: match.value.trimEnd()
          }
        });
      }

      for (const match of findMatches(block.analysisText, / {2,}(?=[\p{Script=Han}A-Za-z0-9])/gu)) {
        if (match.start === 0) {
          continue;
        }
        context.report({
          block,
          start: match.start,
          end: match.end,
          message: "正文使用一个半角空格，不使用连续空格。",
          fix: {
            range: [match.start, match.end],
            text: " "
          }
        });
      }
    }
  }
});

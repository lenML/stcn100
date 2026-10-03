import { defineRule, findMatches } from "@stcn100/core";

const REPEATED_PUNCTUATION = /。{2,}|！{2,}|？{2,}|，{2,}|；{2,}|：{2,}|[!?]{2,}|[,;:]{2,}/gu;

function normalizedPunctuation(value: string): string {
  const first = value[0] ?? "";
  return first === "," ? "，" : first === ";" ? "；" : first === ":" ? "：" : first;
}

export const repeatedPunctuationRule = defineRule({
  meta: {
    id: "repeated-punctuation",
    description: "合并重复标点。",
    category: "punctuation",
    confidence: "deterministic",
    fixable: true
  },
  check(document, _options, context): void {
    for (const block of document.blocks) {
      for (const match of findMatches(block.analysisText, REPEATED_PUNCTUATION)) {
        context.report({
          block,
          start: match.start,
          end: match.end,
          message: `重复标点“${match.value}”。保留一个。`,
          fix: {
            range: [match.start, match.end],
            text: normalizedPunctuation(match.value)
          }
        });
      }
    }
  }
});

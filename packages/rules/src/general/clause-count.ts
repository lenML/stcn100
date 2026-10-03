import { defineRule, findMatches } from "@stcn100/core";

export interface ClauseCountOptions {
  max?: number;
}

const CLAUSE_BREAK = /[，,；;]/gu;
const SENTENCE = /[^。！？!?\n]+[。！？!?]?/gu;

export const clauseCountRule = defineRule<ClauseCountOptions>({
  meta: {
    id: "clause-count",
    description: "限制单句中的并列分句数量。",
    category: "clarity"
  },
  check(document, options, context): void {
    const max = options.max ?? 3;
    for (const block of document.blocks) {
      for (const sentence of block.analysisText.matchAll(SENTENCE)) {
        if (sentence.index === undefined) {
          continue;
        }
        const matches = findMatches(sentence[0], CLAUSE_BREAK);
        if (matches.length > max) {
          context.report({
            block,
            start: sentence.index,
            end: sentence.index + sentence[0].length,
            message: `单句分句分隔符 ${matches.length} 个，超过上限 ${max}。拆分句子。`,
            data: { count: matches.length, max }
          });
        }
      }
    }
  }
});

import { defineRule, findTermMatches } from "@stcn100/core";

export interface FutureTenseOptions {
  terms?: string[];
}

export const DEFAULT_FUTURE_TERMS = ["将会被", "将要被", "将会", "将要", "届时将"];


export const futureTenseRule = defineRule<FutureTenseOptions>({
  meta: {
    id: "coding/future-tense",
    description: "技术文档优先描述当前行为、条件或直接命令，减少未来时态。",
    category: "clarity"
  },
  check(document, options, context): void {
    const terms = options.terms ?? DEFAULT_FUTURE_TERMS;
    for (const block of document.blocks) {
      for (const match of findTermMatches(block.analysisText, terms)) {
        context.report({
          block,
          start: match.start,
          end: match.end,
          message: `避免未来时态“${match.value}”。改写为现在时、条件句或直接命令。`,
          data: { term: match.value }
        });
      }
    }
  }
});

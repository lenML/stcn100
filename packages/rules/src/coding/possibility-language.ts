import { defineRule, findTermMatches } from "@stcn100/core";

export interface PossibilityOptions {
  terms?: string[];
}

export const DEFAULT_POSSIBILITY_TERMS = ["可能会", "可能", "也许", "或许", "大概"];


export const possibilityLanguageRule = defineRule<PossibilityOptions>({
  meta: {
    id: "coding/possibility-language",
    description: "技术文档避免无条件的可能性描述。",
    category: "clarity"
  },
  check(document, options, context): void {
    const terms = options.terms ?? DEFAULT_POSSIBILITY_TERMS;
    for (const block of document.blocks) {
      for (const match of findTermMatches(block.analysisText, terms)) {
        context.report({
          block,
          start: match.start,
          end: match.end,
          message: `可能性表达“${match.value}”：确认依据；如有不确定性，写明条件、概率或影响。`,
          data: { term: match.value }
        });
      }
    }
  }
});

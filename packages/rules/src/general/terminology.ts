import { defineRule, findTermMatches } from "@stcn100/core";

export interface TerminologyEntry {
  preferred: string;
  aliases: string[];
}

export interface TerminologyOptions {
  terms?: TerminologyEntry[];
}


export const terminologyRule = defineRule<TerminologyOptions>({
  meta: {
    id: "terminology",
    description: "统一项目术语，标记非首选同义词。",
    category: "consistency",
    fixable: true
  },
  check(document, options, context): void {
    for (const block of document.blocks) {
      for (const entry of options.terms ?? []) {
        const aliases = entry.aliases.filter((alias) => alias !== entry.preferred);
        for (const match of findTermMatches(block.analysisText, aliases)) {
          context.report({
            block,
            start: match.start,
            end: match.end,
            message: `术语不一致：使用“${entry.preferred}”，不要使用“${match.value}”。`,
            fix: {
              range: [match.start, match.end],
              text: entry.preferred
            },
            data: { preferred: entry.preferred, alias: match.value }
          });
        }
      }
    }
  }
});

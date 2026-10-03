import { defineRule, findMatches } from "@stcn100/core";

interface RedundantPattern {
  pattern: RegExp;
  message: string;
}

const PATTERNS: RedundantPattern[] = [
  { pattern: /因为[^。！？!?]{0,100}所以/gu, message: "“因为……所以”可只保留一层因果关系。" },
  { pattern: /由于[^。！？!?]{0,100}因此/gu, message: "“由于……因此”可只保留一层因果关系。" },
  { pattern: /虽然[^。！？!?]{0,100}但是/gu, message: "“虽然……但是”可精简连接结构。" },
  { pattern: /如果[^。！？!?]{0,100}那么/gu, message: "“如果……那么”可精简连接结构。" }
];

export const redundantConnectiveRule = defineRule({
  meta: {
    id: "redundant-connective",
    description: "标记可压缩的成对连接结构。",
    category: "clarity"
  },
  check(document, _options, context): void {
    for (const block of document.blocks) {
      for (const item of PATTERNS) {
        for (const match of findMatches(block.analysisText, item.pattern)) {
          context.report({
            block,
            start: match.start,
            end: match.end,
            message: item.message
          });
        }
      }
    }
  }
});

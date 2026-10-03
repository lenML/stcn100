import { defineRule } from "@stcn100/core";

const PAIRS = new Map([
  ["（", "）"],
  ["(", ")"],
  ["「", "」"],
  ["『", "』"],
  ["《", "》"],
  ["【", "】"],
  ["“", "”"]
]);
const CLOSERS = new Set(PAIRS.values());

export const pairedPunctuationRule = defineRule({
  meta: {
    id: "paired-punctuation",
    description: "检查块内成对标点的顺序和闭合。",
    category: "punctuation",
    confidence: "deterministic"
  },
  check(document, _options, context): void {
    for (const block of document.blocks) {
      const stack: Array<{ character: string; index: number }> = [];
      for (let index = 0; index < block.analysisText.length; index += 1) {
        const character = block.analysisText[index] ?? "";
        const closing = PAIRS.get(character);
        if (closing) {
          stack.push({ character, index });
          continue;
        }
        if (!CLOSERS.has(character)) {
          continue;
        }

        const opening = stack.at(-1);
        if (!opening || PAIRS.get(opening.character) !== character) {
          context.report({
            block,
            start: index,
            end: index + 1,
            message: `成对标点“${character}”缺少匹配的开括号。`
          });
          continue;
        }
        stack.pop();
      }

      for (const opening of stack) {
        context.report({
          block,
          start: opening.index,
          end: opening.index + 1,
          message: `成对标点“${opening.character}”未闭合。`
        });
      }
    }
  }
});

import { defineRule, findMatches } from "@stcn100/core";

interface QuantityPattern {
  pattern: RegExp;
  message: string;
}

const PATTERNS: QuantityPattern[] = [
  {
    pattern: /缩小(?:了)?\s*[0-9]+(?:\.[0-9]+)?\s*倍/gu,
    message: "“缩小 N 倍”含义不明确。改为“缩小到原来的 1/N”。"
  },
  {
    pattern: /不超过\s*[0-9]+(?:\.[0-9]+)?\s*以上/gu,
    message: "“不超过 N 以上”逻辑冲突。保留一个边界表达。"
  },
  {
    pattern: /翻了\s*[0-9]+(?:\.[0-9]+)?\s*倍/gu,
    message: "“翻了 N 倍”容易歧义。写明“变为原来的 N+1 倍”。"
  },
  {
    pattern: /大约[^。！？!?]{0,20}左右/gu,
    message: "“大约”和“左右”可能重复。保留一个不确定表达。"
  }
];

export const quantityLogicRule = defineRule({
  meta: {
    id: "quantity-logic",
    description: "检测数值倍数和上下界表达的逻辑冲突。",
    category: "clarity",
    confidence: "deterministic"
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

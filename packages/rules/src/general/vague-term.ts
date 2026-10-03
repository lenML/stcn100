import { defineRule, findTermMatches } from "@stcn100/core";

export interface VagueTerm {
  term: string;
  suggestion: string;
}

export interface VagueTermOptions {
  terms?: VagueTerm[];
}

export const DEFAULT_VAGUE_TERMS: VagueTerm[] = [
  { term: "等等", suggestion: "列出具体项目或说明范围" },
  { term: "相关信息", suggestion: "明确信息名称" },
  { term: "相关内容", suggestion: "明确内容名称或范围" },
  { term: "适当", suggestion: "给出可判断的条件或数值" },
  { term: "必要时", suggestion: "说明触发条件" },
  { term: "原则上", suggestion: "说明规则和例外条件" },
  { term: "一些", suggestion: "给出数量、范围或清单" },
  { term: "若干", suggestion: "给出数量或范围" },
  { term: "一系列", suggestion: "列出步骤或项目" }
];


export const vagueTermRule = defineRule<VagueTermOptions>({
  meta: {
    id: "vague-term",
    description: "标记缺少数量、范围或条件的模糊表达。",
    category: "clarity"
  },
  check(document, options, context): void {
    const terms = options.terms ?? DEFAULT_VAGUE_TERMS;
    for (const block of document.blocks) {
      const byTerm = new Map(terms.map((item) => [item.term, item]));
      for (const match of findTermMatches(block.analysisText, terms.map((item) => item.term))) {
        const item = byTerm.get(match.value);
        if (!item) {
          continue;
        }
        context.report({
          block,
          start: match.start,
          end: match.end,
          message: `模糊表达“${item.term}”：${item.suggestion}。`,
          data: { term: item.term, suggestion: item.suggestion }
        });
      }
    }
  }
});

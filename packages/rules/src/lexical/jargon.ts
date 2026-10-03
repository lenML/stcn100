import { defineRule, findTermMatches } from "@stcn100/core";

export interface JargonEntry {
  term: string;
  suggestion: string;
}

export interface JargonOptions {
  terms?: JargonEntry[];
}

export const DEFAULT_JARGON_TERMS: JargonEntry[] = [
  { term: "赋能", suggestion: "写清提供的能力或具体动作" },
  { term: "抓手", suggestion: "改为关键措施或具体机制" },
  { term: "闭环", suggestion: "改为完整流程，并写明开始、处理和完成条件" },
  { term: "沉淀", suggestion: "改为形成、积累或保存" },
  { term: "对齐", suggestion: "改为统一或确认一致" },
  { term: "对标", suggestion: "写明对比对象和比较维度" },
  { term: "拉通", suggestion: "改为连接或贯通" },
  { term: "打通", suggestion: "改为连接或贯通" },
  { term: "联动", suggestion: "写清联动对象和触发条件" },
  { term: "洞察", suggestion: "改为分析结论或具体发现" },
  { term: "赛道", suggestion: "改为业务领域或市场范围" },
  { term: "心智", suggestion: "改为用户认知或用户印象" },
  { term: "调性", suggestion: "改为风格或品牌语气" },
  { term: "战役", suggestion: "改为专项活动或阶段计划" },
  { term: "链路", suggestion: "改为流程、依赖关系或调用路径" },
  { term: "势能", suggestion: "改为具体优势或资源" },
  { term: "兜底", suggestion: "写出失败后的具体保障机制" },
  { term: "落盘", suggestion: "改为写入文件或保存到本地" },
  { term: "收口", suggestion: "改为完成、汇总或关闭事项" },
  { term: "透传", suggestion: "改为原样传给下游" }
];

export const jargonRule = defineRule<JargonOptions>({
  meta: {
    id: "jargon",
    description: "标记可能掩盖具体动作的业务黑话。",
    category: "clarity",
    confidence: "heuristic"
  },
  check(document, options, context): void {
    const terms = options.terms ?? DEFAULT_JARGON_TERMS;
    const byTerm = new Map(terms.map((item) => [item.term, item]));
    for (const block of document.blocks) {
      for (const match of findTermMatches(block.analysisText, terms.map((item) => item.term))) {
        const item = byTerm.get(match.value);
        if (!item) {
          continue;
        }
        context.report({
          block,
          start: match.start,
          end: match.end,
          message: `空泛表达“${item.term}”：${item.suggestion}。`,
          data: { term: item.term, suggestion: item.suggestion }
        });
      }
    }
  }
});

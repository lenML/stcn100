import { defineRule, findTermMatches } from "@stcn100/core";

export interface ContextWordEntry {
  term: string;
  message: string;
}

export interface ContextWordOptions {
  terms?: ContextWordEntry[];
}

export const DEFAULT_CONTEXT_WORDS: ContextWordEntry[] = [
  { term: "登陆", message: "确认语义：登录系统使用“登录”；登陆陆地或天体使用“登陆”。" },
  { term: "配制", message: "确认语义：配置参数使用“配置”；配制溶液使用“配制”。" },
  { term: "起用", message: "确认语义：启用功能使用“启用”；起用人员使用“起用”。" },
  { term: "标示", message: "确认语义：标识字段使用“标识”；标示位置使用“标示”。" },
  { term: "帐户", message: "确认项目是否统一为“账户”。" },
  { term: "帐号", message: "确认项目是否统一为“账号”。" },
  { term: "截止", message: "确认语义：表示时间界限通常使用“截至”；截止日期使用“截止”。" },
  { term: "搜寻", message: "技术文档通常使用“搜索”。" }
];

export const contextWordRule = defineRule<ContextWordOptions>({
  meta: {
    id: "context-word",
    description: "提示依赖语境的中文技术文案用词。",
    category: "consistency",
    confidence: "heuristic"
  },
  check(document, options, context): void {
    const terms = options.terms ?? DEFAULT_CONTEXT_WORDS;
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
          message: item.message,
          data: { term: item.term }
        });
      }
    }
  }
});

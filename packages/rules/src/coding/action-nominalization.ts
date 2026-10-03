import { defineRule, findMatches } from "@stcn100/core";

export interface NominalizationOptions {
  verbs?: string[];
}

export const DEFAULT_ACTION_VERBS = [
  "检查",
  "验证",
  "测试",
  "处理",
  "配置",
  "更新",
  "修改",
  "分析",
  "操作",
  "调整",
  "优化",
  "删除",
  "添加",
  "创建"
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const actionNominalizationRule = defineRule<NominalizationOptions>({
  meta: {
    id: "coding/action-nominalization",
    description: "标记“进行/加以 + 动作名词”的空动词结构。",
    category: "clarity"
  },
  check(document, options, context): void {
    const verbs = options.verbs ?? DEFAULT_ACTION_VERBS;
    if (verbs.length === 0) {
      return;
    }
    const verbPattern = verbs.map(escapeRegExp).join("|");
    const pattern = new RegExp(
      `(?:进行|加以|作出|给予)(?:了)?(?:一次|一个|相应的?|相关的?|有效的?)?(?:${verbPattern})`,
      "gu"
    );

    for (const block of document.blocks) {
      for (const match of findMatches(block.analysisText, pattern)) {
        context.report({
          block,
          start: match.start,
          end: match.end,
          message: `空动词结构“${match.value}”。直接使用动作动词。`,
          data: { phrase: match.value }
        });
      }
    }
  }
});

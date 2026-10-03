import { defineRule, findMatches } from "@stcn100/core";

const PASSIVE_PATTERNS = [
  { pattern: /(?<!植)(?<!棉)(?<!毛巾)被(?!子|褥|动)/gu, message: "疑似被动表达。优先写明执行者和动作。" },
  { pattern: /由(?!于)[^。！？!?，,；;]{0,40}所/gu, message: "“由……所”结构冗长。优先使用主动句。" },
  { pattern: /受到/gu, message: "“受到”可能隐藏执行者和动作。优先使用主动句。" },
  { pattern: /得以/gu, message: "“得以”可能弱化动作。优先使用主动句。" }
];

export const passiveVoiceRule = defineRule({
  meta: {
    id: "passive-voice",
    description: "标记可能的被动表达和弱动作结构。",
    category: "clarity"
  },
  check(document, _options, context): void {
    for (const block of document.blocks) {
      for (const item of PASSIVE_PATTERNS) {
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

import { defineRule, findMatches } from "@stcn100/core";

interface ContextTerm {
  pattern: RegExp;
  message: string;
}

const CONTEXT_TERMS: ContextTerm[] = [
  { pattern: /(?<![A-Za-z0-9_])JS(?![A-Za-z0-9_])/gu, message: "“JS”适合简短界面或既有名称；正式正文可写“JavaScript”。" },
  { pattern: /(?<![A-Za-z0-9_])H5(?![A-Za-z0-9_])/gu, message: "“H5”可能指移动 Web 活动页，不等同于 HTML5 标准。" },
  { pattern: /(?<![A-Za-z0-9_])Postgres(?![A-Za-z0-9_])/gu, message: "“Postgres”可能是项目正式简称；否则使用“PostgreSQL”。" },
  { pattern: /(?<![A-Za-z0-9_])OAuth(?![A-Za-z0-9_.])/gu, message: "“OAuth”可能指协议家族；需要时写明版本。" },
  { pattern: /(?<![A-Za-z0-9_])k8s(?![A-Za-z0-9_])/gu, message: "正式文档可写“Kubernetes”；命令、标签和社区语境可保留“k8s”。" }
];

export const termContextRule = defineRule({
  meta: {
    id: "term-context",
    description: "提示依赖项目或语境的缩写和简称。",
    category: "consistency",
    confidence: "heuristic"
  },
  check(document, _options, context): void {
    for (const block of document.blocks) {
      for (const term of CONTEXT_TERMS) {
        for (const match of findMatches(block.analysisText, term.pattern)) {
          context.report({
            block,
            start: match.start,
            end: match.end,
            message: term.message
          });
        }
      }
    }
  }
});

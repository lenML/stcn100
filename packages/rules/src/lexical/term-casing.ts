import { defineRule } from "@stcn100/core";
import { findReplacementMatches, type ReplacementEntry } from "../utils/replacements.js";

export interface TermCasingEntry {
  pattern: string;
  replacement: string;
}

export interface TermCasingOptions {
  terms?: TermCasingEntry[];
}

export const DEFAULT_CASING_TERMS: TermCasingEntry[] = [
  { pattern: "(?:id|Id)", replacement: "ID" },
  { pattern: "(?:http|Http)", replacement: "HTTP" },
  { pattern: "(?:url|Url)", replacement: "URL" },
  { pattern: "(?:json|Json)", replacement: "JSON" },
  { pattern: "(?:api|Api)", replacement: "API" },
  { pattern: "(?:ai|Ai)", replacement: "AI" },
  { pattern: "javascript", replacement: "JavaScript" },
  { pattern: "typescript", replacement: "TypeScript" },
  { pattern: "(?:llm|Llm)", replacement: "LLM" },
  { pattern: "(?:aigc|Aigc)", replacement: "AIGC" },
  { pattern: "(?:rag|Rag)", replacement: "RAG" },
  { pattern: "(?:chatgpt|Chatgpt)", replacement: "ChatGPT" },
  { pattern: "openai", replacement: "OpenAI" },
  { pattern: "python", replacement: "Python" },
  { pattern: "nodejs", replacement: "Node.js" },
  { pattern: "github", replacement: "GitHub" },
  { pattern: "gitlab", replacement: "GitLab" },
  { pattern: "postgresql", replacement: "PostgreSQL" },
  { pattern: "grpc", replacement: "gRPC" },
  { pattern: "graphql", replacement: "GraphQL" },
  { pattern: "websocket", replacement: "WebSocket" },
  { pattern: "yaml", replacement: "YAML" },
  { pattern: "xml", replacement: "XML" },
  { pattern: "jwt", replacement: "JWT" }
];

function entries(items: TermCasingEntry[]): ReplacementEntry[] {
  return items.map((item) => ({
    pattern: new RegExp(`(?<![A-Za-z0-9_])${item.pattern}(?![A-Za-z0-9_])`, "gu"),
    replacement: item.replacement
  }));
}

export const termCasingRule = defineRule<TermCasingOptions>({
  meta: {
    id: "term-casing",
    description: "统一常见技术术语和缩写的大小写。",
    category: "consistency",
    confidence: "deterministic",
    fixable: true
  },
  check(document, options, context): void {
    for (const block of document.blocks) {
      for (const match of findReplacementMatches(block.analysisText, entries(options.terms ?? DEFAULT_CASING_TERMS))) {
        context.report({
          block,
          start: match.start,
          end: match.end,
          message: `术语写法“${match.value}”。改为“${match.replacement}”。`,
          fix: {
            range: [match.start, match.end],
            text: match.replacement
          },
          data: { replacement: match.replacement }
        });
      }
    }
  }
});

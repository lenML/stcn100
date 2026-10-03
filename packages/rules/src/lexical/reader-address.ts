import { defineRule, findMatches } from "@stcn100/core";

export interface ReaderAddressOptions {
  terms?: string[];
}

export const DEFAULT_ADDRESS_TERMS = ["你", "您", "同学", "同学们"];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isReaderAddressFalsePositive(
  term: string,
  text: string,
  start: number,
  end: number
): boolean {
  return (
    (term === "同学" || term === "同学们") &&
    text.slice(Math.max(0, start - 1), end + 1) === "不同学科"
  );
}

export const readerAddressRule = defineRule<ReaderAddressOptions>({
  meta: {
    id: "reader-address",
    description: "提示技术文档中的直接称呼，项目可覆盖。",
    category: "clarity",
    confidence: "heuristic"
  },
  check(document, options, context): void {
    const terms = options.terms ?? DEFAULT_ADDRESS_TERMS;
    for (const block of document.blocks) {
      for (const term of terms) {
        for (const match of findMatches(block.analysisText, new RegExp(escapeRegExp(term), "gu"))) {
          if (isReaderAddressFalsePositive(term, block.analysisText, match.start, match.end)) {
            continue;
          }
          context.report({
            block,
            start: match.start,
            end: match.end,
            message: `直接称呼“${term}”。确认是否改为无主句或明确角色。`,
            data: { term }
          });
        }
      }
    }
  }
});

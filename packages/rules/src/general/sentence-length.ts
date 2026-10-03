import { countReadableUnits, defineRule } from "@stcn100/core";
import type { RegexMatch } from "@stcn100/core";

export interface SentenceLengthOptions {
  suggestedMax?: number;
  hardMax?: number;
}

function splitSentences(text: string): RegexMatch[] {
  const expression = /[^。！？!?\n]+[。！？!?]?/gu;
  const sentences: RegexMatch[] = [];

  for (const match of text.matchAll(expression)) {
    if (match.index === undefined) {
      continue;
    }
    const original = match[0];
    const leftTrimmed = original.match(/^\s*/u)?.[0].length ?? 0;
    const rightTrimmed = original.match(/\s*$/u)?.[0].length ?? 0;
    const value = original.slice(leftTrimmed, original.length - rightTrimmed);
    if (value.length === 0) {
      continue;
    }
    sentences.push({
      value,
      start: match.index + leftTrimmed,
      end: match.index + leftTrimmed + value.length
    });
  }

  return sentences;
}

export const sentenceLengthRule = defineRule<SentenceLengthOptions>({
  meta: {
    id: "sentence-length",
    description: "限制单句长度，避免中文长句难以解析。",
    category: "clarity"
  },
  check(document, options, context): void {
    const suggestedMax = options.suggestedMax ?? 30;
    const hardMax = options.hardMax ?? 40;

    for (const block of document.blocks) {
      for (const sentence of splitSentences(block.analysisText)) {
        const units = countReadableUnits(sentence.value);
        if (units <= suggestedMax) {
          continue;
        }
        const threshold = units > hardMax ? hardMax : suggestedMax;
        const level = units > hardMax ? "硬上限" : "建议上限";
        context.report({
          block,
          start: sentence.start,
          end: sentence.end,
          message: `句子长度 ${units}，超过${level} ${threshold}。拆成短句。`,
          data: { units, suggestedMax, hardMax }
        });
      }
    }
  }
});

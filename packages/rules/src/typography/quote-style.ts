import { defineRule } from "@stcn100/core";

interface QuotePair {
  start: number;
  end: number;
  depth: number;
  style: "curly" | "ascii";
}

function collectPairs(text: string, style: "curly" | "ascii"): {
  pairs: QuotePair[];
  unmatched: number[];
} {
  const pairs: QuotePair[] = [];
  const unmatched: number[] = [];
  const stack: number[] = [];
  let asciiOpen = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? "";
    if (style === "curly") {
      if (character === "“") {
        stack.push(index);
      } else if (character === "”") {
        const start = stack.pop();
        if (start === undefined) {
          unmatched.push(index);
        } else {
          pairs.push({ start, end: index, depth: stack.length, style });
        }
      }
      continue;
    }

    if (character !== "\"") {
      continue;
    }
    if (!asciiOpen) {
      stack.push(index);
      asciiOpen = true;
    } else {
      const start = stack.pop();
      if (start === undefined) {
        unmatched.push(index);
      } else {
        pairs.push({ start, end: index, depth: stack.length, style });
      }
      asciiOpen = false;
    }
  }

  unmatched.push(...stack);
  return { pairs, unmatched };
}

function quoteFor(depth: number, closing: boolean): string {
  if (depth > 0) {
    return closing ? "』" : "『";
  }
  return closing ? "」" : "「";
}

export const quoteStyleRule = defineRule({
  meta: {
    id: "quote-style",
    description: "统一中文正文引号为直角引号，并处理嵌套。",
    category: "punctuation",
    confidence: "deterministic",
    fixable: true
  },
  check(document, _options, context): void {
    for (const block of document.blocks) {
      const pairs = [
        ...collectPairs(block.analysisText, "curly").pairs,
        ...collectPairs(block.analysisText, "ascii").pairs
      ].sort((left, right) => left.start - right.start || right.end - left.end);

      const topLevel: QuotePair[] = [];
      for (const pair of pairs) {
        if (topLevel.some((outer) => pair.start > outer.start && pair.end < outer.end)) {
          continue;
        }
        topLevel.push(pair);

        let replacement = "";
        let asciiOpen = false;
        for (let index = pair.start; index <= pair.end; index += 1) {
          const character = block.analysisText[index] ?? "";
          const sourceCharacter = block.text[index] ?? "";
          if (index === pair.start) {
            replacement += quoteFor(pair.depth, false);
          } else if (index === pair.end) {
            replacement += quoteFor(pair.depth, true);
          } else if (character === "“") {
            replacement += "『";
          } else if (character === "\"") {
            replacement += asciiOpen ? "』" : "『";
            asciiOpen = !asciiOpen;
          } else if (character === "”") {
            replacement += "』";
          } else {
            replacement += sourceCharacter;
          }
        }

        context.report({
          block,
          start: pair.start,
          end: pair.end + 1,
          message: "中文正文引号改为直角引号；嵌套引号使用「『』」。",
          fix: {
            range: [pair.start, pair.end + 1],
            text: replacement
          }
        });
      }

      for (const index of [
        ...collectPairs(block.analysisText, "curly").unmatched,
        ...collectPairs(block.analysisText, "ascii").unmatched
      ]) {
        context.report({
          block,
          start: index,
          end: index + 1,
          message: "引号未配对。检查引号开闭。"
        });
      }
    }
  }
});

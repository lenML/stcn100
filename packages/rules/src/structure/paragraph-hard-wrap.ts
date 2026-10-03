import { defineRule, joinChineseLines } from "@stcn100/core";

export const paragraphHardWrapRule = defineRule({
  meta: {
    id: "paragraph-hard-wrap",
    description: "检测 Markdown 正文段落中的手工硬换行。",
    category: "structure",
    confidence: "deterministic",
    fixable: true
  },
  check(document, _options, context): void {
    if (document.sourceType !== "markdown") {
      return;
    }

    for (const hardWrap of document.hardWraps) {
      const previous = document.blocks.find((block) => block.range[1] === hardWrap.range[0]);
      const current = document.blocks.find((block) => block.range[0] === hardWrap.range[1]);
      if (!previous || !current) {
        continue;
      }
      const replacement = joinChineseLines(previous.text, current.text);
      context.report({
        block: previous,
        start: previous.text.length,
        end: previous.text.length,
        message: `第 ${hardWrap.startLine} 至 ${hardWrap.endLine} 行疑似为了源码行宽手工断行。合并为一段一行。`,
        fix: {
          range: [
            previous.text.length,
            previous.text.length + hardWrap.range[1] - hardWrap.range[0]
          ],
          text: replacement
        },
        data: { startLine: hardWrap.startLine, endLine: hardWrap.endLine }
      });
    }
  }
});

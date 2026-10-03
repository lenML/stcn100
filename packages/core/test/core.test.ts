import { describe, expect, it } from "vitest";
import {
  createRegistry,
  definePlugin,
  defineRule,
  IntlWordTokenizer,
  lint,
  parseDocument,
  resolveConfig
} from "../src/index.js";

describe("IntlWordTokenizer", () => {
  it("returns lossless offsets for mixed Chinese and Latin text", () => {
    const source = "使用 API 获取数据";
    const tokens = new IntlWordTokenizer().tokenize(source);

    expect(tokens.map((token) => token.text).join("")).toBe(source);
    expect(tokens.some((token) => token.text === "API" && token.kind === "word")).toBe(true);
  });

  it("classifies grouped decimals and symbols", () => {
    const tokenizer = new IntlWordTokenizer();
    for (const [source, kind] of [
      ["12,000.5", "number"],
      ["+", "symbol"],
      ["$", "symbol"],
      ["😀", "symbol"]
    ] as const) {
      const tokens = tokenizer.tokenize(source);
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ text: source, kind });
    }
  });
});

describe("parseDocument", () => {
  it("extracts prose and masks inline code and fences", () => {
    const source = "# 标题\n\n正文 `将会检查` 和 [链接](https://example.com)。\n\n```ts\n将会检查\n```\n";
    const document = parseDocument("doc.md", source);

    expect(document.blocks).toHaveLength(2);
    expect(document.blocks[0]?.kind).toBe("heading");
    expect(document.blocks[1]?.analysisText).toContain("正文");
    expect(document.blocks[1]?.analysisText).not.toContain("将会检查");
    expect(document.blocks[1]?.analysisText).not.toContain("https://example.com");
    expect(document.blocks[1]?.analysisText).toContain("链接");
  });
  it("protects bare URLs, indented code, and multiline comments", () => {
    const source = [
      "正文 https://example.com/设定。",
      "    const value = \"设定\";",
      "<!--",
      "设定",
      "-->",
      "正文。"
    ].join("\n");
    const document = parseDocument("doc.md", source);

    expect(document.blocks).toHaveLength(2);
    expect(document.blocks[0]?.analysisText).not.toContain("设定");
    expect(document.blocks[1]?.analysisText).toBe("正文。");
  });

  it("does not close a fence on a line with trailing text", () => {
    const source = "```\n设定\n```not-close\n设定\n```\n正文。\n";
    const document = parseDocument("doc.md", source);

    expect(document.blocks).toHaveLength(1);
    expect(document.blocks[0]?.analysisText).toBe("正文。");
  });

  it("protects multiline inline code without hiding following prose", () => {
    const source = "说明 `中文\n阀值`。阀值需要调整。\n";
    const document = parseDocument("doc.md", source);

    expect(document.blocks[0]?.analysisText).not.toContain("中文");
    expect(document.blocks[0]?.analysisText).not.toContain("阀值");
    expect(document.blocks[0]?.analysisText).toHaveLength(document.blocks[0]?.text.length ?? 0);
    expect(document.blocks[1]?.analysisText).toContain("。阀值需要调整。");
  });

  it("protects code fences inside blockquotes and list items", () => {
    for (const source of [
      "> ```text\n> 阀值\n> ```\n> 阀值需要调整。\n",
      "- ```text\n  阀值\n  ```\n\n阀值需要调整。\n"
    ]) {
      const document = parseDocument("doc.md", source);
      const visible = document.blocks.map((block) => block.analysisText).join("\n");
      expect(visible).toContain("阀值需要调整。");
      expect(visible.match(/阀值/gu)).toHaveLength(1);
    }
  });

  it("keeps container fences open across blank lines", () => {
    const source = "- ```text\n  阀值\n\n  阀值\n  ```\n阀值需要调整。\n";
    const document = parseDocument("doc.md", source);
    const visible = document.blocks.map((block) => block.analysisText);

    expect(visible).toEqual(["阀值需要调整。"]);
  });

  it("masks balanced parentheses in Markdown link targets", () => {
    const document = parseDocument("doc.md", "[文档](https://example.com/foo(设定))。\n");
    const block = document.blocks[0];

    expect(block?.analysisText).toContain("文档");
    expect(block?.analysisText).not.toContain("example.com");
    expect(block?.analysisText).not.toContain("设定");
    expect(block?.analysisText).toHaveLength(block?.text.length ?? 0);
  });

  it("masks balanced parentheses in bare URLs", () => {
    const document = parseDocument("doc.md", "正文 https://example.com/foo(设定) 后。\n");
    const block = document.blocks[0];

    expect(block?.analysisText).toContain("正文");
    expect(block?.analysisText).not.toContain("example.com");
    expect(block?.analysisText).not.toContain("设定");
    expect(block?.analysisText).toHaveLength(block?.text.length ?? 0);
  });

  it("ignores disable directives inside protected inline and HTML content", () => {
    const source = [
      "正文 `<!-- stcn100-disable-file -->`",
      "<pre>",
      "<!-- stcn100-disable-line -->",
      "</pre>",
      "阀值。"
    ].join("\n");
    const document = parseDocument("doc.md", source);

    expect(document.disabledLines).toEqual([]);
    expect(document.blocks.some((block) => block.analysisText.includes("阀值"))).toBe(true);
  });

  it("masks API paths and multiline HTML attributes", () => {
    const source = "/api\n<a id=\"api\"\n title=\"阀值 > 0\">阀值</a>\n";
    const document = parseDocument("doc.md", source);

    expect(document.blocks[0]?.analysisText).not.toContain("/api");
    expect(document.blocks[1]?.analysisText).toContain("阀值");
    expect(document.blocks[1]?.analysisText).not.toContain("api");
  });

  it("does not hide prose after an unclosed quote fence exits its container", () => {
    const document = parseDocument("doc.md", "> ```text\n> 阀值\n\n阀值需要调整。\n");
    const visible = document.blocks.map((block) => block.analysisText).join("\n");
    expect(visible).toContain("阀值需要调整。");
  });

  it("skips Markdown table separator rows", () => {
    const source = "| 名称 | 值 |\n|:---|---:|\n| 甲 | 乙 |\n";
    const document = parseDocument("doc.md", source);

    expect(document.blocks).toHaveLength(4);
    expect(document.blocks.every((block) => block.kind === "table")).toBe(true);
    expect(document.blocks.some((block) => block.text.includes("---"))).toBe(false);
  });

  it("splits Markdown table rows into cell blocks with exact ranges", () => {
    const source = "| 名称 | 值 |\n| --- | --- |\n| 甲 | 乙 |\n";
    const document = parseDocument("doc.md", source);
    const cells = document.blocks.map((block) => ({
      analysisText: block.analysisText,
      rangeText: source.slice(block.range[0], block.range[1]),
      text: block.text
    }));

    expect(cells).toEqual([
      { analysisText: " 名称 ", rangeText: " 名称 ", text: " 名称 " },
      { analysisText: " 值 ", rangeText: " 值 ", text: " 值 " },
      { analysisText: " 甲 ", rangeText: " 甲 ", text: " 甲 " },
      { analysisText: " 乙 ", rangeText: " 乙 ", text: " 乙 " }
    ]);
  });

  it("keeps escaped pipes and pipes in inline code inside table cells", () => {
    const source = "| 甲 \\| 乙 | 使用 `a|b` |\n";
    const document = parseDocument("doc.md", source);

    expect(document.blocks).toHaveLength(2);
    expect(document.blocks[0]?.text).toBe(" 甲 \\| 乙 ");
    expect(document.blocks[1]?.text).toBe(" 使用 `a|b` ");
    expect(document.blocks[1]?.analysisText).toHaveLength(
      document.blocks[1]?.text.length ?? 0
    );
    expect(document.blocks[1]?.analysisText).not.toContain("a|b");
  });

  it("records Markdown paragraph hard wraps", () => {
    const document = parseDocument("doc.md", "第一行\n第二行\n\n第三行  \n第四行\n");

    expect(document.hardWraps).toHaveLength(1);
    expect(document.hardWraps[0]).toMatchObject({ startLine: 1, endLine: 2 });
  });

  it("supports unified line and file disable directives", () => {
    const lineDisabled = parseDocument(
      "doc.md",
      "阀值。 <!-- stcn100-disable-line -->\n阀值。\n"
    );
    expect(lineDisabled.disabledLines).toEqual([1]);
    expect(lineDisabled.blocks).toHaveLength(1);

    const fileDisabled = parseDocument("doc.md", "<!-- copy-lint-disable-file -->\n阀值。\n");
    expect(fileDisabled.blocks).toHaveLength(0);
  });
});

describe("lint", () => {
  const rule = defineRule({
    meta: {
      id: "replace-a",
      description: "replace",
      category: "consistency",
      fixable: true
    },
    check(document, _options, context): void {
      for (const block of document.blocks) {
        const start = block.analysisText.indexOf("甲");
        if (start >= 0) {
          context.report({
            block,
            start,
            end: start + 1,
            message: "replace 甲",
            fix: { range: [start, start + 1], text: "乙" }
          });
        }
      }
    }
  });
  const plugin = definePlugin({
    name: "test",
    rules: [
      rule,
      defineRule<{ text: string }>({
        meta: {
          id: "option-rule",
          description: "option rule",
          category: "clarity"
        },
        check(document, options, context): void {
          context.report({
            block: document.blocks[0]!,
            start: 0,
            end: 0,
            message: options.text
          });
        }
      })
    ],
    presets: {
      base: {
        name: "base",
        rules: {
          "replace-a": "error",
          "option-rule": ["warning", { text: "preset option" }]
        }
      }
    }
  });
  const registry = createRegistry([plugin]);
  const config = resolveConfig({ extends: ["base"], rules: { "option-rule": "off" } }, registry);

  it("keeps fixes as diagnostics when fix mode is off", () => {
    const result = lint({ filePath: "a.txt", source: "甲。", config, registry });
    expect(result.output).toBe("甲。");
    expect(result.fixed).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.fix?.text).toBe("乙");
  });

  it("applies fixes when fix mode is on", () => {
    const result = lint({ filePath: "a.txt", source: "甲。", config, registry, fix: true });
    expect(result.output).toBe("乙。");
    expect(result.fixed).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does not let whitespace fixes cross protected Markdown masks", () => {
    const collapseSpacesRule = defineRule({
      meta: {
        id: "collapse-spaces",
        description: "collapse spaces",
        category: "structure",
        fixable: true
      },
      check(document, _options, context): void {
        for (const block of document.blocks) {
          for (const match of block.analysisText.matchAll(/ {2,}/gu)) {
            if (match.index === undefined) {
              continue;
            }
            context.report({
              block,
              start: match.index,
              end: match.index + match[0].length,
              message: "collapse spaces",
              fix: {
                range: [match.index, match.index + match[0].length],
                text: " "
              }
            });
          }
        }
      }
    });
    const protectedRegistry = createRegistry([
      definePlugin({ name: "protected-test", rules: [collapseSpacesRule] })
    ]);
    const protectedConfig = resolveConfig(
      { rules: { "collapse-spaces": "error" } },
      protectedRegistry
    );

    for (const source of [
      "正文 `阀值` 后。\n",
      "正文 https://example.com/设定 后。\n",
      "正文 [文档](https://example.com/foo(设定)) 后。\n",
      "正文 <!-- 阀值 --> 后。\n",
      "正文 <span title=\"阀值\">可见</span> 后。\n"
    ]) {
      const result = lint({
        filePath: "a.md",
        source,
        config: protectedConfig,
        registry: protectedRegistry,
        fix: true
      });
      expect(result.output).toBe(source);
    }
  });

  it("keeps same-position insertion fixes in diagnostic order", () => {
    const insertionRule = (id: string, text: string) =>
      defineRule({
        meta: {
          id,
          description: id,
          category: "structure",
          fixable: true
        },
        check(document, _options, context): void {
          const block = document.blocks[0];
          if (block?.text !== "甲。") {
            return;
          }
          context.report({
            block,
            start: 0,
            end: 0,
            message: id,
            fix: { range: [0, 0], text }
          });
        }
      });
    const insertionRegistry = createRegistry([
      definePlugin({
        name: "insertion-test",
        rules: [insertionRule("a-insert", "A"), insertionRule("b-insert", "B")]
      })
    ]);
    const insertionConfig = resolveConfig(
      { rules: { "a-insert": "error", "b-insert": "error" } },
      insertionRegistry
    );
    const result = lint({
      filePath: "a.txt",
      source: "甲。",
      config: insertionConfig,
      registry: insertionRegistry,
      fix: true
    });

    expect(result.output).toBe("AB甲。");
  });

  it("keeps preset options when a user changes only severity", () => {
    const overridden = resolveConfig(
      {
        extends: ["base"],
        rules: {
          "option-rule": "error"
        }
      },
      registry
    );
    expect(overridden.rules["option-rule"]).toEqual({
      severity: "error",
      options: { text: "preset option" }
    });
  });
  it("rejects invalid severities and disabled unknown rules", () => {
    expect(() => resolveConfig({ rules: { "replace-a": "fatal" } }, registry)).toThrow(
      "Invalid severity"
    );
    expect(() => resolveConfig({ rules: { "unknown-rule": "off" } }, registry)).toThrow(
      "Unknown rule"
    );
  });

  it("filters diagnostics disabled by line or file directives", () => {
    const lineDisabled = lint({
      filePath: "a.txt",
      source: "甲。 <!-- stcn100-disable-line -->\n",
      config,
      registry
    });
    expect(lineDisabled.diagnostics).toHaveLength(0);

    const fileDisabled = lint({
      filePath: "a.txt",
      source: "<!-- stcn100-disable-file -->\n甲。\n",
      config,
      registry
    });
    expect(fileDisabled.diagnostics).toHaveLength(0);
  });
});

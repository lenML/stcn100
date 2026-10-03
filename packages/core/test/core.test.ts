import { describe, expect, it } from "vitest";
import {
  createRegistry,
  definePlugin,
  defineRule,
  lint,
  parseDocument,
  resolveConfig
} from "../src/index.js";

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
});

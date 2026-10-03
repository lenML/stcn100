import { createRegistry, lint, resolveConfig, type RuleSettingInput } from "@stcn100/core";
import { describe, expect, it } from "vitest";
import { builtinPlugin } from "../src/index.js";

const registry = createRegistry([builtinPlugin]);

function run(source: string, rules?: Record<string, RuleSettingInput | undefined>, fix = false) {
  const config = resolveConfig(
    {
      extends: ["general"],
      rules
    },
    registry
  );
  return lint({ filePath: "sample.md", source, config, registry, fix });
}

describe("general rules", () => {
  it("reports repeated punctuation without changing source unless fix is enabled", () => {
    const result = run("失败！！！\n");
    expect(result.output).toBe("失败！！！\n");
    expect(result.diagnostics.map((item) => item.ruleId)).toContain("repeated-punctuation");
  });

  it("fixes repeated punctuation", () => {
    const result = run("失败！！！\n", undefined, true);
    expect(result.output).toBe("失败！\n");
  });

  it("uses configured terminology and safely replaces aliases", () => {
    const rules = {
      terminology: [
        "warning",
        {
          terms: [{ preferred: "配置", aliases: ["设定"] }]
        }
      ]
    };
    const result = run("设定服务。\n", rules, true);
    expect(result.output).toBe("配置服务。\n");
  });

  it("does not fix terminology inside protected content", () => {
    const rules = {
      terminology: [
        "warning",
        {
          terms: [{ preferred: "配置", aliases: ["设定"] }]
        }
      ]
    };
    const source = [
      "正文 https://example.com/设定。",
      "    ～",
      "<!--",
      "设定",
      "-->"
    ].join("\n");
    const result = run(source, rules, true);
    expect(result.output).toBe(source);
  });

  it("counts clause breaks per sentence", () => {
    const result = run("第一句，很短。第二句，很短。第三句，很短。第四句，很短。\n");
    expect(result.diagnostics.map((item) => item.ruleId)).not.toContain("clause-count");
  });

  it("does not treat Markdown table separators as body punctuation", () => {
    const source = "| 名称 | 值 |\n| --- | --- |\n| 甲 | 乙 |\n";
    const result = run(source, { "punctuation-style": "warning" }, true);

    expect(result.output).toBe(source);
    expect(result.diagnostics.map((item) => item.ruleId)).not.toContain("punctuation-style");
  });

  it("counts sentence length and clauses per Markdown table cell", () => {
    const cell = " 甲乙丙丁戊己庚辛，甲乙丙丁 ";
    const source = `|${cell}|${cell}|${cell}|${cell}|\n`;
    const result = run(source);
    const ids = result.diagnostics.map((item) => item.ruleId);

    expect(ids).not.toContain("sentence-length");
    expect(ids).not.toContain("clause-count");
  });

  it("does not report common passive-like false positives", () => {
    const result = run("植被很好。被子放在床上。由于网络故障所以服务停止。\n");
    expect(result.diagnostics.map((item) => item.ruleId)).not.toContain("passive-voice");
  });

  it("fixes high-confidence typos and common term casing", () => {
    const result = run("请调整阀值，大小 10GB，使用API。\n", undefined, true);
    expect(result.output).toBe("请调整阈值，大小 10 GB，使用 API。\n");
  });

  it("fixes punctuation, quote, and numeric spacing", () => {
    const punctuation = run("检查结果...连接失败(测试)。\n", undefined, true);
    expect(punctuation.output).toBe("检查结果……连接失败（测试）。\n");

    const quote = run("点击“保存”。\n", undefined, true);
    expect(quote.output).toBe("点击「保存」。\n");

    const nestedQuote = run("提示为“请选择“保存””。\n", undefined, true);
    expect(nestedQuote.output).toBe("提示为「请选择『保存』」。\n");

    const numeric = run("文件大小 10GB。等待 200ms，增长 50 %，温度 25°C。\n", undefined, true);
    expect(numeric.output).toBe("文件大小 10 GB。等待 200 ms，增长 50%，温度 25 °C。\n");
  });

  it("fixes mixed nested quotes without duplicating opening marks", () => {
    const result = run('提示为“请选择"保存"”。\n', undefined, true);
    expect(result.output).toBe('提示为「请选择『保存』」。\n');
  });

  it("preserves CLI flags and distinguishes ratios from clock times", () => {
    const option = run("使用 --help。\n", undefined, true);
    expect(option.output).toBe("使用 --help。\n");

    const ratio = run("比例 1 : 30。\n", undefined, true);
    expect(ratio.output).toBe("比例 1 : 30。\n");

    const clock = run("时间 09 : 30。\n", undefined, true);
    expect(clock.output).toBe("时间 09:30。\n");
  });

  it("does not duplicate fixes when CJK spacing and numeric spacing overlap", () => {
    const result = run("容量为10GB，耗时200ms，温度25°C。\n", undefined, true);
    expect(result.output).toBe("容量为 10 GB，耗时 200 ms，温度 25 °C。\n");
  });

  it("reports jargon and direct reader address as candidates", () => {
    const result = run("通过一站式能力赋能你完成任务。\n");
    const ids = result.diagnostics.map((item) => item.ruleId);
    expect(ids).toContain("jargon");
    expect(ids).toContain("reader-address");
  });

  it("does not apply lexical rules inside URLs, API paths, or code fences", () => {
    const result = run([
      "https://example.com/api",
      "```",
      "阀值 api",
      "```",
      "/api",
      ""
    ].join("\n"));
    const ids = result.diagnostics.map((item) => item.ruleId);
    expect(ids).not.toContain("typo");
    expect(ids).not.toContain("term-casing");
  });

  it("reports context words, context abbreviations, quantity logic, and unpaired punctuation", () => {
    const result = run("登陆系统，制作 H5 页面，缩小了 3 倍，提示（未闭合。\n");
    const ids = result.diagnostics.map((item) => item.ruleId);
    expect(ids).toContain("context-word");
    expect(ids).toContain("term-context");
    expect(ids).toContain("quantity-logic");
    expect(ids).toContain("paired-punctuation");
  });

  it("joins Markdown paragraph hard wraps with correct spacing", () => {
    const chinese = run("第一行\n第二行\n", undefined, true);
    expect(chinese.output).toBe("第一行第二行\n");

    const mixed = run("说明\nAPI\n", undefined, true);
    expect(mixed.output).toBe("说明 API\n");

    const explicit = run("第一行  \n第二行\n", undefined, true);
    expect(explicit.output).toBe("第一行  \n第二行\n");
  });
});

describe("coding profile", () => {
  it("extends general and reports one longest possibility term", () => {
    const config = resolveConfig({ extends: ["coding"] }, registry);
    const result = lint({ filePath: "sample.md", source: "服务可能会失败。\n", config, registry });
    const possibility = result.diagnostics.filter(
      (diagnostic) => diagnostic.ruleId === "coding/possibility-language"
    );
    expect(possibility).toHaveLength(1);
    expect(possibility[0]?.message).toContain("可能会");
  });

  it("does not match every action phrase when the verb list is empty", () => {
    const config = resolveConfig(
      {
        extends: ["coding"],
        rules: {
          "coding/action-nominalization": ["warning", { verbs: [] }]
        }
      },
      registry
    );
    const result = lint({ filePath: "sample.md", source: "这里会进行。\n", config, registry });
    expect(result.diagnostics.map((item) => item.ruleId)).not.toContain(
      "coding/action-nominalization"
    );
  });
});

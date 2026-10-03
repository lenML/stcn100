import { createRegistry, lint, resolveConfig } from "@stcn100/core";
import { describe, expect, it } from "vitest";
import { builtinPlugin } from "../src/index.js";

const registry = createRegistry([builtinPlugin]);

function run(source: string, rules?: Record<string, unknown>, fix = false) {
  const config = resolveConfig(
    {
      extends: ["general"],
      rules: rules as never
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

  it("does not report common passive-like false positives", () => {
    const result = run("植被很好。被子放在床上。由于网络故障所以服务停止。\n");
    expect(result.diagnostics.map((item) => item.ruleId)).not.toContain("passive-voice");
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
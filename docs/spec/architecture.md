# 架构设计

## 1. 目标

`stcn100` 将四类职责分开：

1. 规范：定义中文技术写作规则和默认值。
2. 引擎：解析文档、加载配置、执行规则、计算诊断、应用修复。
3. 规则包：提供通用、编程或其他场景规则。
4. 工具：CLI、IDE、CI 或服务端适配层。

核心包不包含任何内置规则。`@stcn100/cli` 负责把 `@stcn100/rules` 注入核心引擎。

## 2. 数据流

```text
CLI args
  -> load config
  -> resolve extends and rule severity
  -> collect files
  -> parse source into Document
  -> mask protected Markdown content
  -> run configured rules over TextBlock[]
  -> normalize Diagnostic[]
  -> optional fix passes
  -> text or JSON report
  -> exit code
```

修复按字符区间执行。核心引擎按逆序替换，避免偏移漂移。修复最多迭代 10 轮，直到没有新的安全修复。

## 3. 包边界

### `@stcn100/core`

- `Document`、`TextBlock`、`Diagnostic`、`RuleModule` 等协议。
- Markdown/纯文本基础解析。
- 配置预设展开和规则设置规范化。
- 规则注册表。
- 诊断位置计算。
- 安全修复执行。
- `Tokenizer` 协议与默认 `Intl.Segmenter` 实现。

不依赖 Node 文件系统，也不依赖具体内置规则。

### `@stcn100/rules`

- 通用中文规则。
- `general` 预设。
- `coding` 预设，继承 `general`。
- 每个规则只通过 `RuleModule` 协议接入。

### `@stcn100/cli`

- 读取 `stcn100.config.json`。
- 收集文件。
- 注入内置插件。
- 输出 text/JSON。
- 处理 `--fix`、`--quiet`、`--max-warnings` 和退出码。

## 4. 规则模型

```ts
interface RuleModule<TOptions> {
  meta: RuleMeta;
  check(document: Document, options: TOptions, context: RuleContext): void;
}
```

规则通过 `context.report()` 返回：

- 规则 ID。
- 严重级别。
- 文件、行列和字符区间。
- 消息与机器可读数据。
- 可选安全修复。

规则还可以通过 `context.tokenize()` 使用文档语言分析器。默认 tokenizer 是 Node.js `Intl.Segmenter`；规则不得直接依赖某个 jieba 包。

规则不得直接写文件，也不得处理配置继承。引擎统一负责。

## 5. 配置与预设

配置优先级从低到高：

1. 预设继承链中的规则设置。
2. 用户配置中的规则设置。
3. CLI `--profile` 对 `extends` 的替换。
4. CLI 运行选项。

规则设置支持：

```json
{
  "rule-id": "off",
  "rule-id": "warning",
  "rule-id": ["error", { "option": "value" }]
}
```

未知预设和未知规则直接报配置错误，不静默忽略。

## 6. 文档保护

Markdown 处理器当前保护：

- YAML frontmatter。
- 围栏代码块。
- 四空格或 Tab 缩进代码块。
- 行内代码。
- 单行和多行 HTML 注释、标签。
- 图片。
- 裸 URL 和自动链接。
- API 路径。
- 链接目标，只保留链接文字。
- 跨行行内代码。
- Markdown 表格分隔行。

Markdown 表格正文按单元格建立 block，避免将整行拼接为一个句子。

保护实现通过等长掩码保留字符偏移，规则看到 `analysisText`，报告仍指向原文件 `text`。

## 7. 扩展点

### 自定义规则包

```ts
import { definePlugin, defineRule } from "@stcn100/core";

const noFoo = defineRule({
  meta: {
    id: "team/no-foo",
    description: "禁止团队禁用词",
    category: "consistency"
  },
  check(document, _options, context) {
    // report diagnostics
  }
});

export const teamPlugin = definePlugin({
  name: "@team/stcn100-rules",
  rules: [noFoo],
  presets: {
    team: {
      name: "team",
      extends: ["general"],
      rules: {
        "team/no-foo": "warning"
      }
    }
  }
});
```

后续需要增加插件名称空间解析、JavaScript/TypeScript 配置和外部包加载。

### 文档格式适配器

当前支持 Markdown 与纯文本。后续可增加：

- AsciiDoc。
- reStructuredText。
- HTML。
- DITA XML。
- Office Open XML。
- 文档站点 AST。

适配器只负责生成 `Document`；规则协议不变。

## 8. 设计约束

- 默认规则必须低误报、可解释。
- 语义不确定时只警告，不自动修复。
- 规则元数据区分 deterministic、heuristic 和 semantic。
- 规则数据与标准正文分离，不保存第三方规范全文。
- 所有词表、阈值和场景规则都可配置。
- 诊断必须稳定排序。
- 严格模式只能提高退出码或级别，不暗中改写文本。
- 新规则必须有正例、反例、保护区和修复测试。

## 9. 已知限制

- Markdown 解析仍是轻量行解析，不是完整 AST。
- 跨文件术语、缩写、引用一致性尚未实现。
- 默认分词无 POS；`@node-rs/jieba` 等适配器尚未发布。
- JavaScript/TypeScript 配置文件和第三方插件加载尚未实现。
- 跨块成对标点和复杂嵌套列表仍只能保守处理。
- 文本框、表格语义和复杂垂直列表只做基础处理。

# stcn100

Simplified Technical Chinese tools。

`stcn100` 是一个面向中文技术写作的规范草案与 lint 工具。设计受 ASD-STE100 启发，但不逐条翻译英文规则，也不替代正式标准。

目标：

- 提供通用、可验证、可扩展的中文技术写作规则。
- 分离规范、规则引擎、场景预设和 CLI。
- 默认支持通用文档与编程文档场景。
- 通过项目术语表和配置适配团队、产品、领域。
- 对代码、URL、链接目标等受保护内容跳过正文检查。

当前为 `0.1.0` MVP，接口可能变化。

## 快速开始

```bash
pnpm install
pnpm build
pnpm stcn100 --help
pnpm stcn100 "docs/**/*.md" --profile general,coding
pnpm stcn100 "docs/**/*.md" --profile general,coding --fix
```

初始化配置：

```bash
pnpm stcn100 init
```

查看内置规则：

```bash
pnpm stcn100 rules
```

## 配置

`stcn100.config.json`：

```json
{
  "extends": ["general", "coding"],
  "ignore": ["vendor/**"],
  "rules": {
    "sentence-length": ["warning", { "suggestedMax": 30, "hardMax": 40 }],
    "terminology": [
      "warning",
      {
        "terms": [
          {
            "preferred": "配置",
            "aliases": ["设定"]
          }
        ]
      }
    ]
  }
}
```

规则级别：`off`、`info`、`warning`、`error`。命令 `--profile` 会覆盖配置中的 `extends`。

## 内置规则

| 规则 | 默认级别 | 自动修复 | 用途 |
| --- | --- | --- | --- |
| `sentence-length` | warning | 否 | 限制单句长度 |
| `clause-count` | warning | 否 | 限制逗号链和分句数量 |
| `vague-term` | warning | 否 | 标记模糊条件、数量和范围 |
| `repeated-punctuation` | error | 是 | 合并重复标点 |
| `redundant-connective` | warning | 否 | 标记冗余连接结构 |
| `passive-voice` | warning | 否 | 标记疑似被动表达 |
| `terminology` | warning | 是 | 统一项目术语 |
| `coding/future-tense` | warning | 否 | 减少技术文档未来时态 |
| `coding/action-nominalization` | warning | 否 | 标记“进行 + 动作名词” |
| `coding/possibility-language` | warning | 否 | 标记无条件可能性表达 |

完整说明见 [规则文档](docs/spec/rules.md)。

## 仓库结构

```text
packages/core   规则协议、解析、配置、诊断、修复引擎
packages/rules  通用规则、coding 规则、内置预设
packages/cli    文件收集、配置加载、文本/JSON 报告
docs/research   ASD-STE100、中文标准、工具生态调研
docs/spec       规范、规则、CLI、架构设计
```

## 开发

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

## 文档

- [架构设计](docs/spec/architecture.md)
- [规则规范](docs/spec/rules.md)
- [CLI 规范](docs/spec/cli.md)
- [路线图](docs/roadmap.md)
- [ASD-STE100 调研](docs/research/asd-ste100.md)
- [中文写作标准调研](docs/research/chinese-writing-standards.md)
- [Lint 工具生态调研](docs/research/tooling-landscape.md)

## 边界

`stcn100` 只做可解释的静态检查。长句拆分、指代消解、术语同义判断、事实正确性和安全风险等级仍需人工评审。项目不包含 ASD-STE100、国家标准或其他第三方规范全文。

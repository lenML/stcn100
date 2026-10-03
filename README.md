# stcn100

`stcn100` 是一套面向中文技术写作的可程序化规范与 lint 工具。它受 ASD-STE100 启发，但不逐条翻译英文标准，也不替代正式标准。

它关注可以直接交给程序检查的问题。例如句子长度、模糊表达、错词和术语。它还检查标点、数字格式和中西文间距。内置 `general` 与 `coding` 场景，并允许项目通过规则配置和术语表扩展。

## 发送给 Agent

复制下面内容给 Agent：

```text
请阅读
https://raw.githubusercontent.com/lenML/stcn100/main/skill/SKILL.md
然后扫描当前项目中的中文技术文档，根据 stcn100 的建议修复问题。
修复后重新运行 stcn100，并汇总已修复项和仍需人工判断的项。
```

## 快速开始

无需安装即可体验：

```bash
npx @lenml/stcn100@latest --help
npx @lenml/stcn100@latest init
npx @lenml/stcn100@latest "docs/**/*.md"
npx @lenml/stcn100@latest "docs/**/*.md" --profile coding
npx @lenml/stcn100@latest "docs/**/*.md" --profile coding --fix
```

未指定文件时，stcn100 默认扫描 `**/*.{md,markdown,mdx,txt}`。

查看规则：

```bash
npx @lenml/stcn100@latest rules
```

只运行指定规则：

```bash
npx @lenml/stcn100@latest "docs/**/*.md" --rule typo
npx @lenml/stcn100@latest "docs/**/*.md" --rule typo,repeated-punctuation
```

输出机器可读结果：

```bash
npx @lenml/stcn100@latest "docs/**/*.md" --format json
```

## 工作方式

- `general`：通用中文技术文档规则。
- `coding`：编程与技术文档场景，包含 `general`。
- `--fix`：只应用规则明确标记为安全的修复。
- `stcn100.config.json`：配置规则级别、选项、忽略路径和项目术语。

诊断分为三类：

- `deterministic`：解析和配置确定后，结果可重复，通常可直接修复。
- `heuristic`：位置可稳定定位，但是否违规依赖上下文，需要人工确认。
- `semantic`：需要事实源、schema 或完整语义判断，工具只提供候选。

初始化配置：

```bash
npx @lenml/stcn100@latest init
```

## 文档

- [Agent Skill](skill/SKILL.md)
- [CLI 使用说明](docs/spec/cli.md)
- [规则规范](docs/spec/rules.md)
- [架构设计](docs/spec/architecture.md)
- [Tokenizer 规范](docs/spec/tokenization.md)
- [路线图](docs/roadmap.md)
- [ASD-STE100 调研](docs/research/asd-ste100.md)
- [中文写作标准调研](docs/research/chinese-writing-standards.md)
- [格式化工具兼容性](docs/research/formatter-compatibility.md)

## 开发

```bash
pnpm install
pnpm check
pnpm stcn100 "docs/**/*.md" --profile general,coding
```

## 边界

stcn100 只做可解释的静态检查。长句拆分和指代消解需要人工评审。被动改主动、事实补全、术语语义和安全风险也需要人工判断。项目不包含 ASD-STE100、国家标准或其他第三方规范全文。

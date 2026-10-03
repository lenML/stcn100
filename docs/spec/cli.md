# CLI 规范

## 1. 命令

```text
stcn100 [lint] [files...] [options]
stcn100 rules
stcn100 init
```

未提供子命令时默认执行 `lint`。未提供文件时扫描 `**/*.{md,markdown,mdx,txt}`。

## 2. 参数

| 参数 | 说明 |
| --- | --- |
| `-c, --config <path>` | 指定 JSON 配置文件 |
| `-p, --profile <names>` | 逗号或空格分隔的预设，可重复传入；覆盖配置 `extends` |
| `-r, --rule <id>` | 逗号分隔的规则 ID，可重复传入；只运行指定规则 |
| `-f, --format <format>` | `text` 或 `json` |
| `--fix` | 应用规则提供的安全修复 |
| `--max-warnings <n>` | warning 数量超过 n 时退出 1 |
| `-q, --quiet` | 只显示 error |
| `-h, --help` | 帮助 |
| `-v, --version` | 版本 |

示例：

```bash
pnpm stcn100 "docs/**/*.md" --profile general,coding
pnpm stcn100 "docs/**/*.md" --profile coding --format json
pnpm stcn100 "docs/**/*.md" --rule typo
pnpm stcn100 "docs/**/*.md" --rule typo,repeated-punctuation
pnpm stcn100 "docs/**/*.md" -r typo -r sentence-length
pnpm stcn100 "docs/**/*.md" --fix
pnpm stcn100 "docs/**/*.md" --max-warnings 0
```

规则在配置解析后筛选，保留原 severity、options 和 ignore。未知规则或已配置为 `off` 的规则会以退出码 2 失败。

## 3. 配置发现

顺序：

1. `--config` 指定文件。
2. 当前目录 `stcn100.config.json`。
3. 当前目录 `.stcn100rc.json`。
4. 当前目录 `package.json` 的 `stcn100` 字段。
5. 无配置时使用 `general`。

配置文件必须是 JSON 对象。

## 4. 忽略规则

默认忽略：

```text
**/node_modules/**
**/.git/**
**/dist/**
**/coverage/**
```

配置 `ignore` 会追加忽略模式。

## 5. 报告

文本格式：

```text
docs/guide.md
  12:3  warning  heuristic      句子长度 35，超过建议上限 30。拆成短句。  sentence-length

1 files, 0 errors, 1 warnings, 0 infos
```

JSON 格式包含 `summary` 和 `reports`。每个诊断包含：

- `ruleId`
- `severity`
- `confidence`
- `message`
- `filePath`
- `loc`
- 可选 `fix`
- 可选 `data`

## 6. 退出码

| 退出码 | 含义 |
| --- | --- |
| `0` | 无 error，且 warning 未超过阈值 |
| `1` | 存在 error，或 warning 超过 `--max-warnings` |
| `2` | 参数、配置、文件或运行错误 |

`--fix` 后 CLI 报告剩余诊断，并按剩余结果计算退出码。

## 7. 当前限制

- 配置只支持 JSON。
- 不支持 stdin。
- 不支持外部插件包加载。
- `--quiet` 只隐藏 warning/info，不改变退出码计算；JSON 与 text 的 summary 是显示后的摘要。

## 8. 禁用指令

```markdown
保留原文 <!-- stcn100-disable-line -->
```

文件级：

```markdown
<!-- stcn100-disable-file -->
```

同时兼容 `copy-lint-disable-line` 和 `copy-lint-disable-file`。代码块和 HTML 块中的指令不生效。

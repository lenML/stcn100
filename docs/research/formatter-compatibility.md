# stcn100 与 Markdown formatter/linter 兼容性实测

## 1. 测试范围

测试日期：2026-10-04。

测试目标：

- Prettier 默认 `proseWrap: preserve` 是否与 `paragraph-hard-wrap` 冲突。
- Prettier `--prose-wrap always` 是否与 `paragraph-hard-wrap` 形成循环修复。
- `markdownlint-cli2 --fix` 后再运行 stcn100，是否出现新诊断或改动同一位置。
- `stcn100 --fix` 后 Prettier `--check` 是否稳定。
- 区分真实冲突、仓库文档未格式化、规则观点差异。

环境：

| 项目              | 版本或状态                                 |
| ----------------- | ------------------------------------------ |
| 日期              | 2026-10-04                                 |
| 工作目录          | `O:\work_space\github.com\@lenML\stcn100`  |
| Git 提交          | `6883979d15fa3aa41110673869cab9b758edc0aa`，docs 清理前基线 |
| stcn100           | `0.2.0`，先运行 `pnpm build`               |
| Node.js           | `v22.17.0`                                 |
| pnpm              | `10.12.4`                                  |
| Prettier          | `3.9.9`                                    |
| markdownlint-cli2 | `v0.23.3`                                  |
| markdownlint      | `0.41.1`                                   |

所有 fixture 均放在 `%TEMP%\stcn100-formatter-20261004-lf`，不写入仓库文档。

fixture 使用 UTF-8 无 BOM 和 LF。PowerShell 的 `Set-Content` 可能写入 CRLF，会让 Prettier 因行尾改变而失败，污染结论。本次使用 `[IO.File]::WriteAllText()` 固定 LF。

## 2. 结论摘要

| 场景                                                        | 结论                                                                                                                                      | 类型           |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Prettier 默认 `proseWrap: preserve` + `paragraph-hard-wrap` | 稳定。Prettier 不重新换行，stcn100 合并后 Prettier `--check` 通过。                                                                       | 兼容           |
| Prettier `proseWrap: always` + `paragraph-hard-wrap`        | 明确循环。Prettier 按宽度换行，stcn100 合并，Prettier 再换回相同内容。                                                                    | 真冲突         |
| markdownlint 默认 `MD013` + `paragraph-hard-wrap`           | stcn100 合并后触发 101 列 `MD013`。markdownlint 不自动修复，故不循环，但两者无法同时稳定通过。                                            | 真冲突，非循环 |
| `markdownlint-cli2 --fix` 的其他可修规则 + stcn100          | 本 fixture 中，markdownlint 统一列表标记，删除尾随空格。它没有新增 stcn100 诊断。stcn100 仍在原段落位置合并硬换行。                       | 兼容           |
| `stcn100 --fix` 后再跑 Prettier 默认检查                    | 稳定。`prettier --check` 通过，`prettier --write` 报告 unchanged。                                                                        | 兼容           |
| 仓库现有 `docs/**/*.md`、`README.md`                        | Prettier 检查 9 个文件不通过；markdownlint 报告 216 个 issue，7 个文件。属于文档尚未统一格式化或规则观点不同，不是 stcn100 交叉修复循环。 | 基线问题       |

核心判断：真实自动循环只有一种组合。Prettier 强制按列宽换行。stcn100 禁止段落硬换行。

markdownlint 默认 `MD013` 与 stcn100 目标矛盾。`MD013` 不提供自动修复，因此只产生持续诊断。它不会造成来回改写。

## 3. Prettier 默认 `proseWrap: preserve`

### fixture

```markdown
# 标题

这是第一行。
这是第二行。

这是第三行。
这是第四行。
```

### 命令

```powershell
$base = Join-Path $env:TEMP "stcn100-formatter-20261004-lf"
$file = Join-Path $base "prettier-default.md"

pnpm dlx prettier --check $file
node packages/cli/dist/index.js --rule paragraph-hard-wrap $file
node packages/cli/dist/index.js --rule paragraph-hard-wrap --fix $file
pnpm dlx prettier --check $file
pnpm dlx prettier --write $file
```

### 观察

修复前：

```text
这是第一行。
这是第二行。
```

stcn100 诊断：

```text
3:7  warning  paragraph-hard-wrap
6:7  warning  paragraph-hard-wrap
```

`stcn100 --fix` 后：

```markdown
# 标题

这是第一行。这是第二行。

这是第三行。这是第四行。
```

结果：

```text
Prettier --check before: PASS
Prettier --check after:  PASS
Prettier --write after:  unchanged
```

SHA-256：

```text
修复前：CA9DA91CB116032FB708DA5E46FAA38B49CFE0D820FEBE96EE4BEE1AAEB9825F
stcn100 修复后：BC20E2CEC312F83A35C0F646A325B9DEF30C96FC17E64AD67C45FA7E7D5C1BAA
Prettier --write 后：BC20E2CEC312F83A35C0F646A325B9DEF30C96FC17E64AD67C45FA7E7D5C1BAA
```

结论：默认 Prettier 保留现有换行，不撤销 stcn100 的段合并。默认配置兼容。

## 4. Prettier `proseWrap: always` 循环

### fixture

```markdown
# 标题

This paragraph is intentionally long and contains English words so that Prettier with proseWrap always and printWidth 40 wraps it across several lines.
```

### 命令

```powershell
$file = Join-Path $base "prettier-always.md"

pnpm dlx prettier --prose-wrap always --print-width 40 --write $file
node packages/cli/dist/index.js --rule paragraph-hard-wrap $file
node packages/cli/dist/index.js --rule paragraph-hard-wrap --fix $file
pnpm dlx prettier --prose-wrap always --print-width 40 --write $file
```

### 观察

Prettier 强制换行后的状态 A：

```markdown
# 标题

This paragraph is intentionally long and
contains English words so that Prettier
with proseWrap always and printWidth 40
wraps it across several lines.
```

stcn100 对状态 A 报告 3 条诊断：

```text
3:41  warning  paragraph-hard-wrap
4:40  warning  paragraph-hard-wrap
5:40  warning  paragraph-hard-wrap
```

`stcn100 --fix` 后状态 B：

```markdown
# 标题

This paragraph is intentionally long and contains English words so that Prettier with proseWrap always and printWidth 40 wraps it across several lines.
```

再次运行 Prettier 后，内容与状态 A 完全相同。

SHA-256：

```text
状态 A：64DECC4DD38D58E26C4A01468A840861BDCE9F6F00E035A0A6C0B1AE44133658
状态 B：29124F4045B74AED9ED0DA07118D8EF30699925D97E96C30854DC21C6D97AAB2
第二次 Prettier 后：64DECC4DD38D58E26C4A01468A840861BDCE9F6F00E035A0A6C0B1AE44133658
第二次 stcn100 --fix 后：29124F4045B74AED9ED0DA07118D8EF30699925D97E96C30854DC21C6D97AAB2
```

等式：

```text
Prettier -> stcn100 -> Prettier == Prettier
stcn100 -> Prettier -> stcn100 == stcn100
```

结论：这是明确的 2 状态循环。只要段落超过 `printWidth`，Prettier 每次都会制造 stcn100 要删除的硬换行。

## 5. markdownlint-cli2 与 stcn100 的顺序

### fixture

```markdown
# 标题

- 项目一

* 项目二

这是第一行中文文字，用来验证 markdownlint 修复之后 stcn100 是否合并源码行。
这是第二行中文文字，用来验证合并后的长行是否触发 markdownlint 的 MD013 行长度规则。
```

注意：第一行列表项末尾有一个普通空格。

### 命令

```powershell
$file = Join-Path $base "markdownlint-order.md"

node packages/cli/dist/index.js --rule paragraph-hard-wrap $file
pnpm dlx markdownlint-cli2 --fix $file
pnpm dlx markdownlint-cli2 $file
node packages/cli/dist/index.js --rule paragraph-hard-wrap $file
node packages/cli/dist/index.js --rule paragraph-hard-wrap --fix $file
pnpm dlx markdownlint-cli2 $file
pnpm dlx markdownlint-cli2 --fix $file
```

### markdownlint --fix 后

```text
markdownlint-cli2 v0.23.3 (markdownlint v0.41.1)
Attempted: 4 fixes in 1 file
Summary: 0 issues in 0 files
```

文件变化：

```markdown
- 项目一
- 项目二
```

尾随空格已删除，混合列表标记统一为 `-`。段落两行不变。

### stcn100 诊断

`markdownlint --fix` 前：

```text
6:50  warning  deterministic  第 6 至 7 行疑似为了源码行宽手工断行。合并为一段一行。  paragraph-hard-wrap
```

`markdownlint --fix` 后：

```text
6:50  warning  deterministic  第 6 至 7 行疑似为了源码行宽手工断行。合并为一段一行。  paragraph-hard-wrap
```

结果：没有新增 stcn100 诊断，诊断位置相同。

### stcn100 --fix 后

stcn100 将两行段落合并为一行，长度 101 列。

```text
HASH_AFTER_MD=52F3AABD23D92D1C9DDF7CA9340914AEBB43A839F4BBE1C5258E40016C76227F
HASH_AFTER_STCN=2731A01883A57DDB0298D24C11A931F8FBFF368D21912663CAB886D547AF21A3
```

markdownlint 随后报告：

```text
markdownlint-order.md:6:81 error MD013/line-length Line length [Expected: 80; Actual: 101]
Summary: 1 issue in 1 file
```

再次运行 `markdownlint-cli2 --fix`：

```text
Summary: 1 issue in 1 file
HASH_AFTER_MD2=2731A01883A57DDB0298D24C11A931F8FBFF368D21912663CAB886D547AF21A3
```

文件哈希不变，说明 `MD013` 不可自动修复，不产生循环。

结论：

- markdownlint 可修规则在本 fixture 中没有引入新的 stcn100 诊断。
- stcn100 会在原来的硬换行位置合并段落。
- 若 markdownlint 保留默认 `MD013`，stcn100 合并出的长行会持续报错。
- 若要求 markdownlint 0 issue，必须关闭或调整 `MD013`，或关闭 `paragraph-hard-wrap`。

## 6. `stcn100 --fix` 后 Prettier 默认稳定性

### fixture

```markdown
# 标题

这是第一行。
这是第二行。

阈值中的API接口需要中文English间距。
```

### 命令

```powershell
$file = Join-Path $base "stcn100-then-prettier.md"

pnpm dlx prettier --check $file
node packages/cli/dist/index.js $file
node packages/cli/dist/index.js --fix $file
pnpm dlx prettier --check $file
pnpm dlx prettier --write $file
node packages/cli/dist/index.js $file
```

### 观察

stcn100 修复前报告：

```text
1 warning  paragraph-hard-wrap
4 infos    cjk-latin-spacing
```

`stcn100 --fix` 后：

```markdown
# 标题

这是第一行。这是第二行。

阈值中的 API 接口需要中文 English 间距。
```

结果：

```text
Prettier --check before: PASS
Prettier --check after stcn100: PASS
Prettier --write after stcn100: unchanged
stcn100 after Prettier: 0 diagnostics
```

SHA-256：

```text
stcn100 修复后：4929FE9BE6129D3AB3F3E22216C3C8CA29DB4F2157BFAED8A582AFBE824FC2AE
Prettier --write 后：4929FE9BE6129D3AB3F3E22216C3C8CA29DB4F2157BFAED8A582AFBE824FC2AE
```

结论：在 Prettier 默认配置下，`stcn100 --fix` 输出稳定，Prettier 不产生二次改写。

## 7. 引号修复跨越保护区的回归

本次 docs 修复还复现了一个 `quote-style` 修复缺陷：

```markdown
点击“保存 `API` 后继续”。
```

旧实现使用保护区掩码重建引号内部文本，会把行内代码替换成 NUL。修复后使用原文重建，只使用掩码识别引号位置。

回归结果：

```text
点击「保存 `API` 后继续」。
hasNul: false
Prettier --write: unchanged
stcn100 --fix after Prettier: unchanged
```

结论：引号同时跨越行内代码、链接或 HTML 时，仍保留原始保护内容。Prettier 默认配置下不会产生二次修复。

## 8. 现有仓库文档基线

只读检查命令：

```powershell
pnpm dlx prettier --check "docs/**/*.md" "README.md"
pnpm dlx markdownlint-cli2 "docs/**/*.md" "README.md"
```

结果：

```text
Prettier: 9 files failed formatting check.
markdownlint-cli2: 216 issues in 7 files.
```

Prettier 不通过的文件：

```text
docs/research/asd-ste100.md
docs/research/chinese-writing-standards.md
docs/research/tech-doc-style-chinese.md
docs/research/tooling-landscape.md
docs/spec/architecture.md
docs/spec/cli.md
docs/spec/rules.md
docs/spec/tokenization.md
README.md
```

markdownlint 的主要诊断类型包括：

- `MD013/line-length`
- `MD052/reference-links-images`
- `MD034/no-bare-urls`
- `MD036/no-emphasis-as-heading`
- `MD060/table-column-style`
- `MD047/single-trailing-newline`

这些是当前仓库的基线问题。原因包括文档未统一格式化、引用缺失或规则观点不同。它们不等于 stcn100 与 formatter 存在自动循环。本次检查中，`docs/roadmap.md` 是唯一通过 Prettier 的 Markdown 文件。

## 9. 推荐运行顺序

若采用 stcn100 的段落一行策略，推荐配置：

```text
Prettier: proseWrap: preserve
markdownlint: 关闭或调整 MD013
stcn100: 启用 paragraph-hard-wrap
```

推荐顺序：

```powershell
pnpm dlx prettier --write "docs/**/*.md" "README.md"
pnpm dlx markdownlint-cli2 --fix "docs/**/*.md" "README.md"
pnpm stcn100 --fix "docs/**/*.md" "README.md"

pnpm dlx prettier --check "docs/**/*.md" "README.md"
pnpm dlx markdownlint-cli2 "docs/**/*.md" "README.md"
pnpm stcn100 "docs/**/*.md" "README.md"
```

原因：

- 先运行 Prettier，避免强制换行配置参与 stcn100 修复。
- `markdownlint --fix` 在前，处理尾随空格、列表标记等可修格式问题。
- `stcn100 --fix` 在最后执行，作为文本规范修复的最终写入者。
- 最后三个命令只读检查，确认没有交叉改写。
- 如果 markdownlint 最终检查保留默认 `MD013`，stcn100 合并出的长行会导致检查失败。

若必须使用 Prettier `proseWrap: always` 和 `MD013`，则不要启用 `paragraph-hard-wrap`。三者同时启用时，无法同时满足 Prettier 的列宽换行和 stcn100 的段一行要求。

## 10. 最小复现优先级

1. 要复现自动循环，只保留 Prettier `--prose-wrap always`、有限 `--print-width`、`stcn100 --rule paragraph-hard-wrap --fix`。
2. 要复现 markdownlint 冲突，使用超过 80 列的段落，保留默认 `MD013`，并运行 `stcn100 --fix`。
3. 要验证默认兼容性，使用 LF、UTF-8 无 BOM fixture，运行 Prettier 默认检查和 `stcn100 --fix`。
4. 不要用 CRLF 临时文件判断 Prettier 冲突，先统一行尾。

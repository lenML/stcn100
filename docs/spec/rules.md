# 规则规范

`stcn100` 规则输出可定位、可重复、可配置的诊断。规则 ID 不直接复制第三方标准条款。

## 1. 诊断模型

每条诊断包含：

- `ruleId`：稳定规则 ID。
- `severity`：`error`、`warning`、`info`。
- `confidence`：`deterministic`、`heuristic`、`semantic`。
- `loc`：UTF-16 字符偏移和行列位置。
- 可选 `fix`：安全字符区间替换。
- 可选 `data`：机器可读补充数据。

严重级别：

| 级别 | 用途 | 默认退出码 |
| --- | --- | --- |
| `error` | 明确违反项目规则，或会破坏渲染、复制和执行 | 1 |
| `warning` | 高概率问题，需上下文确认 | 0 |
| `info` | 一致性或维护建议 | 0 |
| `off` | 关闭规则 | 不影响 |

置信度：

| 置信度 | 含义 |
| --- | --- |
| `deterministic` | 在解析和配置确定后，结果可重复 |
| `heuristic` | 程序可稳定定位候选，但是否违规依赖语境 |
| `semantic` | 需要事实源、schema 或完整语义判断 |

`--max-warnings` 可把 warning 数量纳入失败判定。

## 2. 通用规则

| 规则 | 默认级别 | 置信度 | 自动修复 | 用途 |
| --- | --- | --- | --- | --- |
| `sentence-length` | warning | heuristic | 否 | 限制单句长度 |
| `clause-count` | warning | heuristic | 否 | 限制单句分句数量 |
| `vague-term` | warning | heuristic | 否 | 标记模糊条件、数量和范围 |
| `repeated-punctuation` | error | deterministic | 是 | 合并重复标点 |
| `redundant-connective` | warning | heuristic | 否 | 标记冗余连接结构 |
| `passive-voice` | warning | heuristic | 否 | 标记疑似被动表达 |
| `terminology` | warning | heuristic | 是 | 统一项目术语 |
| `typo` | error | deterministic | 是 | 修复高置信度错词 |
| `term-casing` | warning | deterministic | 是 | 统一技术术语大小写 |
| `term-context` | info | heuristic | 否 | 提示缩写和简称语境 |
| `context-word` | info | heuristic | 否 | 提示依赖语境的近义词 |
| `jargon` | info | heuristic | 否 | 标记空泛业务黑话 |
| `reader-address` | info | heuristic | 否 | 提示直接称呼读者 |
| `punctuation-style` | warning | deterministic | 是 | 统一省略号、破折号和标点宽度 |
| `quote-style` | warning | deterministic | 是 | 统一 `「」` 和嵌套 `『』` |
| `paired-punctuation` | error | deterministic | 否 | 检查成对标点闭合 |
| `numeric-spacing` | warning | deterministic | 是 | 规范数值、单位和时间间距 |
| `quantity-logic` | warning | deterministic | 否 | 检测数量倍数和边界冲突 |
| `cjk-latin-spacing` | info | deterministic | 是 | 规范中西文留白 |
| `paragraph-hard-wrap` | warning | deterministic | 是 | 合并 Markdown 段落硬换行 |

## 3. Coding 规则

`coding` 继承 `general`。

| 规则 | 默认级别 | 置信度 | 自动修复 | 用途 |
| --- | --- | --- | --- | --- |
| `coding/future-tense` | warning | heuristic | 否 | 减少未来时态 |
| `coding/action-nominalization` | warning | heuristic | 否 | 标记「进行 + 动作名词」 |
| `coding/possibility-language` | info | heuristic | 否 | 标记缺少条件或影响说明的推断表达 |

`coding/possibility-language` 属 `heuristic/info`：定位需结合上下文判断的推断表达，默认不产生 warning，也不使命令失败。项目可按写作规范提升级别；提升前应提供事实源或明确判定条件。

## 4. 规则详情

### `sentence-length`

- 可读单位按一个汉字，或一个拉丁字母/数字词计算。
- 默认建议上限为 30，硬上限为 40；项目可按文档类型覆盖。

### `typo`

- 默认词表：`阀值→阈值`、`布署→部署`、`反回→返回`、`回朔→回溯`、`做为→作为`、`embeding→embedding`、`提示工程学→提示工程`。
- 选项：`terms: [{ term, replacement, message? }]`。

### `term-casing`

- 默认覆盖常见缩写、语言名和产品名：`id→ID`、`api→API`、`json→JSON`、`JavaScript`、`TypeScript`、`Node.js`、`GitHub`、`gRPC`、`GraphQL` 等。
- 选项：`terms: [{ pattern, replacement }]`。项目配置优先。

### `quote-style`

- 顶层引号改为 `「」`。
- 嵌套引号改为 `『』`。
- 支持中文弯引号和 ASCII 双引号配对。
- 未配对引号只报告，不自动修复。

### `cjk-latin-spacing`

- 中文与英文、数字之间插入一个半角空格。
- 全角标点前后不保留异常空格。
- 连续普通空格在正文中合并为一个。
- 不在 URL、API 路径、代码、链接目标和 HTML 属性中运行。

### `paragraph-hard-wrap`

- 只检查 Markdown 正文段落和列表续行。
- 中文接中文不加空格；中文接拉丁或数字加一个空格。
- 行尾两个空格或反斜杠的显式换行不报告。
- 与 Prettier `proseWrap: always` 冲突。使用该配置时应关闭本规则。
- 与 markdownlint 默认 `MD013` 冲突。启用本规则时应关闭或放宽 `MD013`。

## 5. 禁用指令

行级：

```markdown
需要保留的文本 <!-- stcn100-disable-line -->
```

兼容：

```markdown
需要保留的文本 <!-- copy-lint-disable-line -->
```

文件级：

```markdown
<!-- stcn100-disable-file -->
```

或者：

```markdown
<!-- copy-lint-disable-file -->
```

指令位于代码块或 HTML 块中时不生效。

## 6. 自动修复边界

可自动修复：

- 高置信度固定错词。
- 常见技术术语大小写。
- 无歧义项目术语别名。
- 重复标点。
- 中文标点宽度、省略号和破折号。
- 直角引号和嵌套引号。
- 数值、单位、百分号、角度和时间间距。
- 中西文留白。
- Markdown 段落硬换行。

不可自动修复：

- 长句拆分。
- 被动改主动。
- 因果关系重写。
- 空动词结构改写。
- 可能性表达改写。
- 术语同义判断。
- 数量口径和事实补全。
- 指代消解。
- API 状态语义。

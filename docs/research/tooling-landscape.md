# Node/TS 文本 lint 工具生态与 stcn100 架构建议

> 文档状态：调研稿  
> 核对日期：2026-10-04  
> 用途：为 stcn100 的规则引擎、插件模型、CLI 和后续生态提供架构依据。  
> 版本快照：textlint `15.8.0`、Vale `3.24.0`、remark-lint `10.0.1`、remark-cli `12.0.1`、markdownlint `0.41.1`、markdownlint-cli2 `0.23.3`。

## 1. 结论摘要

1. textlint 最适合借鉴「规则、插件、预设、过滤器分离」的模型。它用 TxtAST 统一文本格式，以 Processor 插件解析 Markdown、纯文本和其他格式，以规则报告和修复，以 0、1、2 区分干净、lint 失败和致命失败。
2. Vale 最适合借鉴「格式无关 scope + 小型检查器 + 可配置文件规则」的设计。规则作者只声明 scope、check、message、level 和 action，解析与作用域匹配由核心完成。
3. remark-lint 展示 unified、mdast 和插件管线的优势，但它主要服务 Markdown。其 lint 规则默认产生 warning，CLI 需要 `--frail` 才把 warning 变成非零退出。
4. markdownlint 最适合借鉴「最小字符区间修复」协议。规则输出 `fixInfo`，核心统一应用修复并处理冲突，不让规则直接重写整篇文档。
5. ASD-STE checker 类工具的共同点是：词典和术语库是核心资产；句法检查只能覆盖机械规则；语义、风险和主题判断必须保留人工复核。官方明确表示工具不能替代写作者，也不认证任何工具。
6. stcn100 不应直接绑定 Markdown AST。建议建立格式无关的 `DocumentModel`，由 Processor 适配 Markdown、纯文本，后续再适配代码注释、HTML、XML 等格式。
7. 建议采用 pnpm monorepo：`core`、`language-zh`、`processor-markdown`、`processor-text`、`rules-*`、`preset-*`、`glossary-*`、`cli`、`test-utils` 分层。现有 `core / rules / cli` 可以作为第一版基线继续演进。
8. 自动修复只覆盖确定性问题。术语替换、标点、空格和结构格式可以自动修复；长句拆分、指代消解、语义改写、风险等级判断只能给建议。
9. 规则结果必须携带稳定规则 ID、来源、严重级别、范围、可修复性、证据和置信等级。这样 CLI、编辑器、CI、报告器和未来的语义检查器才能共用同一协议。
10. 中文场景不能直接复制英语「按空格计词」。应把句长定义为可配置指标，例如汉字数、词法词数、分句数、谓词数，并允许场景预设替换默认指标。

## 2. 工具总览

| 工具 | 实现语言 | 主要输入 | 扩展模型 | AST 或 token 模型 | 自动修复 | 配置 | 退出码 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| textlint | TypeScript / JavaScript | Markdown、纯文本，可加 Processor | rule、filter rule、rule preset、processor plugin、formatter | TxtAST，节点包含 `type`、`raw`、`range`、`loc`、`parent` | 规则通过 `fixer` 提供文本区间修改 | `.textlintrc*`、`package.json`、可共享配置 | `0` 无 error；`1` 有 lint error；`2` 致命错误 |
| Vale | Go | Markdown、纯文本、AsciiDoc、reStructuredText、HTML、XML 等 | rule、style、package、scope、filter、action | 内部 markup 块和 scope，不向规则作者暴露通用 AST | 规则通过 action 给出替换、删除、大小写或建议 | `.vale.ini`、glob sections、全局配置叠层 | `0` 无 error；`1` 至少一个 error；`2` Vale 无法运行 |
| remark-lint | TypeScript / JavaScript | Markdown，可扩展 MDX、GFM、frontmatter、math | unified 插件、preset、第三方 lint rule | unified + remark + mdast/unist | 规则主要报告；格式化由 remark-stringify 或其他 transform 完成 | `.remarkrc*`、YAML、JavaScript、`package.json` | 默认 warning 退出 0；`--frail` 使 warning 退出 1 |
| markdownlint | TypeScript / JavaScript | Markdown / CommonMark、GFM、frontmatter | 内置规则、自定义 rule、markdown-it 插件、formatter | micromark token 优先，兼容 markdown-it token，也可 `parser: "none"` | `fixInfo` 精确描述删除和插入，可重复应用 | JSONC、YAML、JavaScript、extends、目录覆盖、内联注释 | CLI2 为 `0` 无 error；`1` 有 error；`2` 运行失败 |
| ASD-STE checker 类 | 多种 | 纯文本、Word、XML、结构化技术文档 | 闭源检查器、术语库、规则配置；开源项目多为固定规则集 | 词典、词性、句法解析、语法规则，公开协议不统一 | 多数给替代词、规则说明和报告，不保证整段自动改写 | 词典、技术名词、技术动词、检查 profile | 无统一约定 |
| `stilist/text_linter` | Go | 纯文本、stdin | 固定规则集，可读取目录 | 文本规则，不提供通用 AST 生态 | 未强调自动修复 | 内置规则 | 未形成通用协议 |

## 3. 工具拆解

### 3.1 textlint

**生态定位**

textlint 是 Node 生态最接近 stcn100 目标的项目。它同时覆盖 Markdown 和纯文本，并把不同格式、规则、预设和输出格式拆成独立扩展点。

**插件模型**

- `rule` 提供检查，也可以提供 fixer。
- `filter rule` 过滤其他规则产生的消息，例如注释控制、节点类型过滤。
- `rule preset` 把多条规则和默认配置打包。
- `processor plugin` 把输入格式转换成统一 TxtAST。
- `formatter` 把结果输出为 stylish、JSON、GitHub、JUnit、SARIF 类格式。
- 包名约定包括 `textlint-rule-*`、`textlint-plugin-*`、`textlint-rule-preset-*`，降低发现和加载成本。

**AST 与文本处理**

- TxtAST 节点至少包含 `type`、`raw`、`range`、`loc`、`parent`。
- `range` 使用字符 offset，`loc` 的 line 从 1 开始，column 从 0 开始。
- 规则 API 使用 visitor 模式访问 `Document`、`Paragraph`、`Str`、`ListItem`、`Table` 等节点。
- 规则不应直接修改 AST，应通过 `report()` 和 `fixer` 输出诊断与修改。
- 内置 Markdown 和纯文本 Processor 说明：格式适配层不应进入规则核心。

**自动修复**

- fixer 支持插入、删除、替换节点或字符区间。
- 最佳实践是最小修复、一条消息一个修复。
- CLI 支持 `--fix` 和 `--dry-run`。
- `--fix` 修完所有问题后退出 0；仍有未修复项则退出 1。

**配置与 CLI**

- 配置支持 JSON、YAML、JavaScript、`package.json`。
- 规则值支持开关、对象选项和 severity：`info`、`warning`、`error`。
- 支持 `--config`、`--ignore-path`、`--stdin`、`--stdin-filename`、`--format`、`--output-file`、`--quiet`、`--cache`、`--print-config`。
- 退出码明确：`0` 无 error，`1` lint error，`2` 配置、规则、插件或文件搜索等致命错误。

**对 stcn100 的价值**

- 借鉴扩展边界和退出码。
- 借鉴 severity 与退出码解耦：warning 默认不失败，error 才失败。
- 保留字符 offset 作为修复主坐标。
- 不照搬 TxtAST 的全部节点。中文规则还需要句子、分句、词、术语、谓词、段落主题等级别的逻辑模型。

### 3.2 Vale

**生态定位**

Vale 是 Go 编写的 prose linter。它强调 markup-aware scoping，用规则配置而不是通用代码插件覆盖大多数场景。

**规则模型**

- 一条规则由 check、scope、message、level、action 和参数组成。
- 内置 check 包括 existence、substitution、occurrence、repetition、consistency、conditional、capitalization、metric、readability、spelling、sequence、script。
- style 是一组规则文件；package 用于安装和共享 style。
- 规则可以继承其他规则，列表和映射支持追加或删除。
- 对规则作者而言，简单规则主要是 YAML 数据；复杂规则才需要脚本。

**Scope 与文本处理**

- 文件解析后成为带 scope 的块。
- scope 是 dot-separated parts，例如 Markdown 列表项可以是 `text.list.md`。
- scope 匹配采用「所有 selector 部分都出现在 block scope 中」，不是前缀或精确匹配。
- 支持 heading、table、list、blockquote、link、code、sentence、paragraph、summary、raw 和 CSS 选择器式 selection。
- Markdown 默认忽略围栏代码、行内代码、数学、URL 和缩进代码块。
- 纯文本按段落和句子切分，未知扩展名默认按整块文本处理。

**自动修复**

- action 包括 replace、remove、edit、convert、suggest。
- 规则加载时校验 action，错误提前报告。
- JSON 输出同时包含 action recipe、suggestions、match、span、line、severity。
- 编辑器和 agent 可以消费确定性建议，不要求 Vale 直接改文件。

**配置与 CLI**

- `.vale.ini` 支持 glob sections、格式关联、目录和路径级覆盖、条件 sections。
- 支持全局配置与项目配置叠层。
- CLI 支持文件、目录、stdin、文本参数、`--output`、`--minAlertLevel`、`--filter`、`--ignore-syntax`、`--no-exit`。
- 退出码只由 error 触发：warning 和 suggestion 不改变退出码。

**对 stcn100 的价值**

- 用「逻辑 scope」替代把 Markdown 节点直接暴露给规则作者。
- 把大量规则表达为数据，降低编写规则的门槛。
- 支持 procedural、descriptive、safety、coding 等文本类型不同阈值。
- action 与诊断分离，便于 CLI、编辑器、agent 共享修复语义。

### 3.3 remark-lint、unified 与 mdast

**生态定位**

remark-lint 建立在 unified、remark 和 mdast 之上，主要检查 Markdown 的语法和风格一致性。它更接近「AST 管线 + 插件集合」，不是通用中文文本规范引擎。

**插件模型**

- unified Processor 串联 parse、transform、stringify。
- remark-lint rule 接收 mdast tree、VFile 和 options。
- `unified-lint-rule` 生成标准插件包装。
- 社区 rule 可以发布为独立包，preset 组合多条规则。
- 配置使用 `plugins` 数组，规则选项由 unified `use()` 决定。

**AST 与修复**

- mdast 使用 unist 位置模型，节点可以有精确 line、column、offset。
- 规则通常通过 `file.message()` 报告，再由 reporter 输出。
- lint 规则主要「检查和报告」，不直接提供与 textlint 或 markdownlint 同等的逐诊断 fix 协议。
- 自动格式化依赖 remark-stringify 或其他 transformer，规则配置与 serializer 设置必须手工同步。
- 只格式化再序列化可能改变未违规内容，因此不适合作为保守 lint fixer。

**配置与 CLI**

- 支持 `.remarkrc`、JSON、YAML、JavaScript、`package.json`。
- CLI 支持 `--output`、`--frail`、`--quiet`、`--silent`、`--report`。
- `--frail` 使 warning 退出 1；没有该选项时 warning 默认不失败。

**对 stcn100 的价值**

- 借鉴 unified 式管线：parse、extract、analyze、report、serialize 明确分层。
- 借鉴 mdast/unist 的位置模型和插件生态。
- 不把「格式化工具」和「语义 lint 工具」混成同一职责。中文规范中的长句、术语和语义规则不能靠重新序列化整篇文档修复。

### 3.4 markdownlint 与 markdownlint-cli2

**生态定位**

markdownlint 专注于 Markdown / CommonMark，规则数量多，修复协议清晰。它适合作为 stcn100 Markdown Processor 的上层结构检查和格式检查组件，而不是中文语义规则核心。

**规则模型**

- 自定义规则包含 names、description、information、tags、parser、function。
- parser 可以是 `micromark`、`markdownit` 或 `none`。
- 规则函数接收 params 与 onError；异步规则需要显式声明。
- 规则输出 lineNumber、detail、context、range 和 fixInfo。
- 规则可按名称、别名、tag、default 配置，支持 error 和 warning severity。

**AST 与文本处理**

- 优先使用 micromark token，表明结构化 token 比纯正则更稳。
- `none` parser 用于纯文本模式，但会失去 Markdown 结构信息。
- 内联 HTML 注释可以控制规则开关、下一行忽略、整文件配置。
- frontmatter 默认可识别并忽略。

**自动修复**

- fixInfo 只描述编辑动作，不允许规则直接写文件。
- 支持指定行号、列号、删除数量、插入文本和删除整行。
- 核心统一应用 `applyFix` / `applyFixes`，天然适合冲突检测和多轮修复。

**配置与 CLI**

- 配置支持 JSON、JSONC、YAML、JavaScript、extends、目录级覆盖、per-path override。
- CLI2 支持 glob、`--fix`、`--format`、自定义 formatter。
- 退出码为：`0` 成功且无 error；`1` 有 error；`2` 运行失败。
- `--format` 模式从 stdin 读取、修复、写 stdout，适合编辑器格式化协议。

**对 stcn100 的价值**

- 采用 `TextEdit` 或 `fixInfo` 式协议，而不是让规则返回整篇新文本。
- 用 parser 选择器或 Processor 适配不同格式。
- 配置文件按目录叠加，场景预设可按 glob 覆盖。
- 输出 formatter 可插拔，默认 CLI 文本、JSON、SARIF、GitHub Actions。

### 3.5 ASD-STE checker 类工具

**官方工具分类**

ASD-STE100 官方把工具分为四类：

- AI-based tools：即时反馈和改写建议，但准确性和隐私风险需评估。
- Word and rule checkers：检查未批准词、未知词、句长、被动语态等，需要接入公司术语库。
- Word checkers only：只做词典验证，缺少术语库时产生大量 unknown word。
- Look-up tools：电子规则和词典检索，不提供完整交互验证。

**典型实现特征**

- Boeing Simplified English Checker：支持批处理和交互检查，使用完整句法分析，提供词典、同义词管理、术语管理、词频和报告能力。其检查项包括句长、段长、名词簇、缺失冠词、复杂助动词、被动语态、多个命令和安全说明。它明确不自动保证整句合规。
- Congree STE Checker：强调形态和语法分析，不依赖简单正则；支持技术名词、检查 profile、用户组和编辑器集成。
- `stilist/text_linter`：开源、Go、纯文本、ASD-STE100 Issue 6 子集，可读文件、目录和 stdin。它适合说明小型 checker 的边界，不足以覆盖完整标准。
- 2026 年出现的 agent skills、AI linter 和提示词项目可以辅助改写和评估，但它们不是权威 checker，不能证明合规，也不应取代确定性规则和术语治理。

**对 stcn100 的价值**

- 规范文本与规则实现分离。规范描述原则、编号、边界和示例；规则包只实现可验证子集。
- 术语库必须外置、可版本化、可按项目覆盖。不要把受版权保护的 ASD-STE100 词典内容直接打包。
- 检查报告要区分确定问题、候选问题、术语问题和人工复核项。
- 操作文和说明文需要不同阈值与不同规则集。
- 任何「改写建议」都必须保留原文、规则来源和证据，不能伪装成确定性合规结论。

## 4. 对比结论

| 架构维度 | 最佳参考 | stcn100 建议 |
| --- | --- | --- |
| 规则扩展 | textlint | 规则、预设、处理器、过滤器、formatter 分离 |
| 数据规则 | Vale | 简单规则用 JSON/YAML 数据表达，复杂规则用 TS |
| 逻辑作用域 | Vale | 使用 block、sentence、token、document 等 Chinese-friendly scope |
| AST 管线 | unified / remark | 保留 parse 与 serialize 分层，但规则读取规范化模型 |
| 修复协议 | markdownlint | 诊断携带最小 `TextEdit`，核心统一解决冲突 |
| 配置叠层 | Vale + markdownlint-cli2 | 预设 extends、glob overrides、项目级术语库 |
| CLI 退出码 | textlint + markdownlint | `0` 干净或全修复，`1` 剩余 error / 超阈值 warning，`2` 致命错误 |
| 纯文本支持 | textlint + Vale | 一等公民 Processor，不通过 Markdown 模拟 |
| Markdown 支持 | remark + markdownlint | mdast/token 用于结构识别，原文 range 用于诊断和修复 |
| 语义边界 | ASD-STE 工具实践 | 机械、解析、词典、语义四级置信模型 |

## 5. stcn100 架构建议

### 5.1 设计目标

1. **格式无关核心**：规则不应知道输入是 Markdown、纯文本、代码注释还是 XML。
2. **规范与实现分离**：`docs/spec` 描述规范，规则包实现可验证子集，词典包提供术语数据。
3. **默认可用，生态可扩展**：内置 recommended preset 开箱可用，插件和第三方规则可独立发布。
4. **确定性优先**：机械规则报 error；解析候选报 warning；词典依赖问题标记来源；语义问题只做 review。
5. **保守修复**：只自动应用无歧义、局部、可逆性高的修改。
6. **中文优先但语言可扩展**：核心接口不写死英文字词边界，也不把所有逻辑写死为中文。
7. **CLI 与库同构**：CLI 只是库 API 的一个适配器，编辑器、CI 和 agent 使用同一诊断协议。
8. **可审计**：每条规则能追溯到规范条款、项目规则、术语库版本和测试样例。

### 5.2 推荐 monorepo 结构

```text
packages/
  core/                 # 引擎、类型、配置、诊断、修复、格式化接口
  language-zh/          # 中文分句、分词、标点、计数和语言分析
  parser/               # Parser/Processor 公共协议
  parser-markdown/      # Markdown -> DocumentModel
  parser-text/          # 纯文本 -> DocumentModel
  parser-code-comments/ # 后续：代码注释 -> DocumentModel
  rules-general/        # 通用中文规则
  rules-technical/      # 技术文档规则
  rules-coding/         # 编程场景规则
  rules-consistency/    # 跨文件术语、缩写、链接一致性
  preset-recommended/   # 推荐默认规则集
  preset-technical/     # 技术文档场景
  preset-coding/        # 编程文档场景
  glossary/             # 词典格式、查询、继承和覆盖
  glossary-base-zh/     # 项目自建基础词表，不复制受版权数据
  cli/                  # 命令、参数、退出码、formatter
  test-utils/           # 规则测试器和 fixtures


规则包按“主题”拆，不按“严重级别”拆。`general`、`technical`、`coding` 是场景边界；每个规则仍可被单个配置开关和覆盖。

### 5.3 建议处理管线

```text
source bytes
  -> Processor 选择
  -> parse / extract
  -> DocumentModel
  -> zh analysis（分句、分词、标点、结构）
  -> rule visitors
  -> diagnostics + text edits
  -> rule fix conflict resolution
  -> reporter / file writer


各层职责：

| 层 | 输入 | 输出 | 禁止事项 |
| --- | --- | --- | --- |
| Processor | 文件路径、原文、格式选项 | `DocumentModel` | 不执行中文规则 |
| Analyzer | DocumentModel | sentences、tokens、terms、metrics | 不决定 severity |
| Rule | DocumentModel、context、options | diagnostics、text edits | 不直接写文件、不改 AST |
| Fixer | diagnostics、原文 | 新原文、应用记录 | 不处理语义改写 |
| Reporter | diagnostics、summary | text、JSON、SARIF、GitHub | 不改变规则语义 |

### 5.4 DocumentModel 建议

当前 `TextBlock` 是可行的第一版，但长期应升级为轻量逻辑 AST：

```ts
interface SourceSpan {
  start: number;
  end: number;
}

interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

interface DocumentNode {
  type: "document" | "section" | "block" | "sentence" | "clause" | "token";
  kind: string;
  text: string;
  span: SourceSpan;
  children?: DocumentNode[];
  meta?: Record<string, unknown>;
}


关键要求：

- 所有节点保留原文 span，诊断和修复统一映射回原文件 offset。
- `analysisText` 与 `text` 分离，保护 Markdown 标记、代码、URL、转义字符和替换占位符。
- block 类型应包含 heading、paragraph、list-item、blockquote、table、code-comment、plain。
- sentence、clause、token 由语言分析层生成，不要求在 parser 阶段生成。
- 跨文件规则需要 FileIndex，但 FileIndex 不应混入单文件 DocumentModel。

### 5.5 规则 API 建议

参考 textlint 的 visitor 和 Vale 的声明式规则，把规则作者接口保持稳定、窄小：

```ts
interface RuleContext {
  report(input: RuleReport): void;
  getSource(node: DocumentNode): string;
  getFilePath(): string;
  getConfigBaseDir(): string;
}

interface RuleModule<Options = unknown> {
  meta: RuleMeta;
  create(context: RuleContext, options: Options): RuleVisitors;
}

interface RuleVisitors {
  Document?(node: DocumentNode): void;
  Block?(node: DocumentNode): void;
  Sentence?(node: DocumentNode): void;
  Clause?(node: DocumentNode): void | Promise<void>;
  Token?(node: DocumentNode): void;
  DocumentExit?(node: DocumentNode): void;
}


`RuleMeta` 至少包含：

- `id`：稳定、不可随文案变化。
- `title`、`description`、`category`。
- `docs`：规范或规则说明链接。
- `source`：项目规则、标准映射或外部来源。
- `fixable`：是否支持确定性修复。
- `certainty`：`mechanical | parsed | dictionary | semantic`。
- `defaultSeverity`：默认级别，不由规则运行时写死。
- `requires`：需要的 analyzer 能力，例如 sentence、token、glossary。

### 5.6 Processor 与插件模型

建议采用四类插件：

1. **Processor**：格式适配。输入源文件，输出 DocumentModel。首版实现 Markdown 和纯文本，后续实现代码注释、HTML、XML、DITA。
2. **Analyzer**：语言分析。首版提供中文分句、分词、标点、句长和术语索引；后续可提供依存句法、指代和主题分析。
3. **Rule**：检查规则。只依赖稳定的 DocumentModel、RuleContext 和共享工具。
4. **Reporter**：输出格式。至少提供 text、JSON、SARIF、GitHub Actions、JUnit。

Glossary 和 preset 可以用数据包实现，不必都做成代码插件。所有扩展使用统一 manifest：

```json
{
  "name": "@stcn100/rule-sentence-length",
  "kind": "rule",
  "apiVersion": "1",
  "requires": ["sentence"],
  "rules": ["sentence-length"]
}


### 5.7 配置建议

建议支持 `stcn100.config.{json,jsonc,yaml,yml,ts,js,mjs}`，优先级由显式 `--config`、项目根配置、父目录配置和用户默认配置逐层合并。

```jsonc
{
  "extends": ["@stcn100/preset-recommended"],
  "glossary": ["@stcn100/glossary-base-zh", "./terms/project.json"],
  "rules": {
    "sentence-length": ["warning", { "metric": "segments", "max": 28 }],
    "terminology": ["error", { "strict": true }]
  },
  "overrides": [
    {
      "files": ["docs/api/**/*.md"],
      "rules": {
        "code-token-format": "error"
      }
    }
  ]
}


配置要求：

- `off | info | warning | error` 与选项元组统一解析。
- preset 必须支持 `extends`、循环检测和确定性覆盖顺序。
- `overrides` 按 glob 匹配，后配置覆盖前配置，但数组型 glossary 默认合并。
- 提供 JSON Schema、`--print-config` 和 `--list-rules`。
- 配置文件错误必须退出 2，不把错误降级为 lint warning。
- 场景预设只改变规则和阈值，不改变规则 ID。

### 5.8 自动修复协议

建议诊断与修复分离，规则只返回最小文本编辑：

```ts
interface TextEdit {
  range: [start: number, end: number];
  newText: string;
  description?: string;
  safe: boolean;
}

interface Diagnostic {
  ruleId: string;
  severity: "info" | "warning" | "error";
  message: string;
  filePath: string;
  loc: SourceSpan;
  evidence?: string;
  suggestions?: string[];
  fix?: TextEdit;
  data?: Record<string, unknown>;
}


修复策略：

- 同一轮按 offset 正向排序，逆序应用，避免偏移漂移。
- 重叠 edit 不自动合并，保留诊断并报告冲突。
- `safe: false` 只能输出 suggestions，`--fix` 不应用。
- 修复后重新解析并重复运行，最多有限轮次，防循环。
- `--fix` 后重新计算退出码；只修掉可修复项但仍有 error 时退出 1。
- `--fix-dry-run` 输出 diff 或 JSON，不写文件。
- `--format` 读取 stdin，应用安全修复，写 stdout，适合编辑器。

### 5.9 CLI 建议

建议命令面：

```text
stcn100 [files/globs...]
stcn100 rules
stcn100 init
stcn100 explain <rule-id>
stcn100 print-config


建议参数：

- `--config <path>`
- `--profile <name,...>`
- `--format <text|json|sarif|github|junit>`
- `--fix`
- `--fix-dry-run`
- `--stdin`、`--stdin-filename`
- `--ignore-path`、`--ignore-pattern`
- `--max-warnings <n>`
- `--quiet`
- `--no-color`
- `--cache`、`--cache-strategy <metadata|content>`
- `--print-config`
- `--list-rules`
- `--no-exit`

建议退出码：

| 退出码 | 含义 |
| --- | --- |
| `0` | 无 error；或 `--fix` 已修复全部 error；warning 未超过 `--max-warnings` |
| `1` | 仍有 error；或 warning 超过 `--max-warnings`；或 dry-run 发现会被修复的 error |
| `2` | 配置、插件、规则加载、解析崩溃、文件搜索等致命错误；`--no-exit` 可把 1 降为 0，不应隐藏 2 |

警告与 error 的退出行为必须配置化。严格 CI 可通过 preset 把特定 warning 提升为 error，而不是让所有 warning 默认失败。

### 5.10 Markdown 与纯文本策略

**Markdown**

- 短期可保留当前 block scanner；中期建议迁移到 `remark-parse + remark-gfm + mdast`，以获得嵌套列表、链接、表格、代码和 frontmatter 的可靠边界。
- Processor 负责把 mdast 转成 DocumentModel，并把 mdast position 映射为原文件 span。
- 默认忽略 fenced code、inline code、HTML、URL、链接目标、YAML/TOML/JSON frontmatter、数学公式。
- 对标题、段落、列表项、引用、表格单元格赋予 scope，不让规则自己解析 Markdown。
- 结构规则可复用 remark-lint / markdownlint，但中文规则不依赖其规则运行时。

**纯文本**

- 纯文本必须是一等输入，不能先改写成 Markdown 再检查。
- 按空行和语义块建立 paragraph；按标点和语言规则建立 sentence。
- stdin 无扩展名时默认按 text；`--stdin-filename` 用于选择 Markdown Processor。
- 无结构文本可回退到按行或整块检查，但诊断必须携带精确 offset。

**代码文档场景**

- 后续 Processor 可解析 JavaScript/TypeScript、Python、Go 等源码注释，但首版不必引入完整 compiler parser。
- 代码、命令、路径、URL、字段名、日志、配置值进入保护 span。
- 编程 preset 只增加场景规则，例如命令使用行内代码、API 名称一致、变量大小写、路径格式。

### 5.11 中文语言层

中文与英文的核心差异：

| 维度 | 英文 checker 常见做法 | stcn100 建议 |
| --- | --- | --- |
| 分词 | 空格和词边界 | `Intl.Segmenter("zh-CN", { granularity: "word" })` 基线 + 词典修正 |
| 句长 | word count | 可配置为汉字数、词法词数、分句数或谓词数 |
| 句子切分 | 句点、问号、叹号 | 中文句末标点、引号、省略号、URL、编号和代码保护 |
| 名词簇 | 空格 token 和 POS | 术语边界 + 分词 + 词性；先做候选，不默认判错 |
| 被动 | `be + past participle` | 中文“被/由/受/为...所”等标记仅作候选 |
| 术语 | 大小写和词形 | 首选术语、别名、禁用词、缩写、英文对应和产品名词表 |
| 操作文 | 祈使形式 | 动词开头、步骤结构、条件前置和动作数量启发式 |
| 说明文 | 被动允许规则 | 段落主题、句数和信息递进需要人工或语义层 |

建议把分析能力拆成 capability：

- `sentence`
- `clause`
- `token`
- `pos`
- `term`
- `markup`
- `metric`
- `cross-file`

规则声明所需 capability，缺失时规则默认跳过或报配置错误，不静默产生错误结果。

### 5.12 诊断、置信度与审计

建议把 ASD-STE 调研中的 M0-M3 边界直接落入诊断协议：

| 置信等级 | 输出 | 能否自动修复 | 典型规则 |
| --- | --- | --- | --- |
| `mechanical` | error 或 warning | 可以，若替换无歧义 | 重复标点、全半角、句数、禁用词 |
| `parsed` | warning | 通常不可以 | 被动候选、长句、名词簇、条件顺序 |
| `dictionary` | warning 或 error | 仅术语映射明确时可以 | 禁用术语、缩写、大小写、产品名 |
| `semantic` | info 或 review | 不可以 | 主题、指代、语义等价、风险等级 |

每个诊断建议包含：

- `ruleId`
- `severity`
- `message`
- `filePath`、`span`、`loc`
- `evidence`
- `certainty`
- `fix` 或 `suggestions`
- `source`
- `docs`
- `data`

这样默认文本输出、JSON、SARIF、编辑器和 agent 都能消费同一数据，不需要每个 reporter 重新推断规则含义。

### 5.13 性能、缓存与测试

性能建议：

- 按内容 hash 缓存 parse 结果和跨文件索引。
- 规则按 capability 分组，缺失 analyzer 时不运行。
- 同一规则只注册一次；相同配置不重复执行。
- 跨文件索引只在启用 consistency 规则时构建。
- 大仓库先支持 content hash 缓存，后续再做增量 AST。

测试建议：

- `test-utils` 提供 `runRule({ valid, invalid, fixes })`。
- 每条规则至少覆盖正例、反例、保护区反例、选项边界、修复结果和重复运行稳定性。
- 规则测试使用合成中文文本，不复制标准或版权词典。
- CLI 增加 golden test：exit code、stdout、stderr、--fix、--format、--print-config。
- 增加真实语料 benchmark，记录 false positive 和修复成功率，而不是只记录规则数量。

## 6. 分阶段落地

### 第一阶段：稳定内核

- 完成 DocumentModel、Rule API、TextEdit、配置合并和退出码。
- 把现有 code fence、frontmatter、inline code、链接保护抽成 Markdown Processor。
- 增加 `--stdin-filename`、`--fix-dry-run`、JSON/SARIF reporter。
- 增加规则测试工具和 `--print-config`。

### 第二阶段：中文能力

- 增加中文分句、分词、标点和计数 analyzer。
- 建立 glossary 数据模型和项目覆盖机制。
- 将标点、数字、术语、句长、重复表达等规则拆包。
- 完成 recommended、technical、coding 三个 preset。

### 第三阶段：生态与集成

- Processor：HTML、XML、DITA、代码注释。
- 跨文件规则：术语、缩写、链接、标题和引用一致性。
- 编辑器 LSP、GitHub Action、pre-commit。
- 可选 AI review adapter，仅输出语义建议，不进入确定性修复闭环。

## 7. 决策清单

以下决策建议在进入实现前固定：

1. stcn100 的核心协议使用 `DocumentModel`，不是 mdast，也不是 TxtAST。
2. 规则通过 `RuleContext.report()` 输出诊断，不直接改文件或 AST。
3. 所有修复使用字符区间 `TextEdit`，由核心统一冲突检测和应用。
4. error、warning、info 的退出行为配置化；默认只由 error 导致退出 1。
5. Markdown 和纯文本为首批 Processor；两者共享规则，不共享解析细节。
6. 规范、规则、术语数据、场景预设分开发布，版本独立。
7. 语义规则标记 `semantic`，默认只做 review，不伪装成机械合规。
8. 不在仓库内打包 ASD-STE100 等受版权保护的词典或标准全文。
9. 每条规则必须有稳定 ID、来源、置信等级、可修复性和测试。
10. CLI 的 JSON、SARIF 和库结果使用同一诊断对象，避免多套模型。

## 8. 参考资料

### 工具官方资料

- textlint 文档：https://textlint.org/docs/
- textlint CLI 与退出码：https://textlint.org/docs/cli
- textlint 规则模型：https://textlint.org/docs/rule
- textlint 修复规则：https://textlint.org/docs/rule-fixable
- textlint Processor：https://textlint.org/docs/plugin
- Vale 文档：https://vale.sh/docs/
- Vale CLI：https://vale.sh/docs/topics/cli
- Vale Styles：https://vale.sh/docs/topics/styles
- Vale Scopes：https://vale.sh/docs/topics/scopes
- Vale 配置：https://vale.sh/docs/topics/.vale.ini
- remark：https://github.com/remarkjs/remark
- remark-lint：https://github.com/remarkjs/remark-lint
- unified：https://github.com/unifiedjs/unified
- mdast：https://github.com/syntax-tree/mdast
- markdownlint：https://github.com/DavidAnson/markdownlint
- markdownlint 自定义规则：https://github.com/DavidAnson/markdownlint/blob/main/doc/CustomRules.md
- markdownlint-cli2：https://github.com/DavidAnson/markdownlint-cli2

### ASD-STE 与 checker 类资料

- ASD-STE100 官方工具说明：https://www.asd-ste100.org/STEsoftware.html
- ASD-STE100 官方主页：https://www.asd-ste100.org/
- Boeing Simplified English Checker：https://www.boeing.com/company/simplified-english-checker
- Congree STE Checker：https://www.congree.com/en/ste-simplified-technical-english
- `stilist/text_linter`：https://github.com/stilist/text_linter
- agent skill 示例：https://github.com/AminBlg/SimpleEnglish

### 仓库内配套调研

- ASD-STE100 规则与实现边界：`docs/research/asd-ste100.md`
- 中文标准、标点、数字、术语与文档场景：`docs/research/chinese-writing-standards.md`
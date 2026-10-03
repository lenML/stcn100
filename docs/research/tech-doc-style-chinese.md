# Fenng/Tech-Doc-Style-Chinese 规则调研

## 1. 调研范围

- 上游仓库：[Fenng/Tech-Doc-Style-Chinese](https://github.com/Fenng/Tech-Doc-Style-Chinese)。
- 固定版本：`726bb3e2cbb97cc6086533b410f46779d3c1028b`，2026-09-29。
- 许可：MIT。本文只做结构化摘要和规则工程分析，不复制完整规范。
- 已覆盖：`SKILL.md`、`NoCode-Skill.md`、`README.md`、`references/`、`scripts/`、`tests/`、CI 工作流和 Agent 元数据。
- 目标：回答一个问题：哪些规则可以完全程序化检测，哪些只能高召回提示，哪些必须依赖事实源或项目语义。

## 2. 核心结论

Fenng 仓库由三部分组成：

1. `SKILL.md` 和 `references/`：写作规范，覆盖面广，主要依赖 Agent 或人工判断。
2. `scripts/lint_copy_rules.py`：轻量正则/状态机检查器，实际程序化规则只覆盖高频词、部分大小写、引号、称呼和少量语境词。
3. `scripts/unwrap_md_paragraphs.py`：Markdown 段落硬换行检测与重排工具，是仓库中最完整的结构化程序化实现。

因此，上游不是完整的程序化规则引擎，也不能证明「找出所有潜在违反规则」。stcn100 应把规范拆成三层：

| 分类 | 定义 | 自动修复边界 | 工程目标 |
| --- | --- | --- | --- |
| `deterministic` | 输入、保护区和项目配置确定后，结论可重复，不依赖主观语义 | 只有替换唯一、事实不变、渲染不变时才允许 `auto-safe` | 高精度，适合 CI 失败 |
| `heuristic` | 可稳定发现候选，但是否违规取决于语境、词义、领域或团队约定 | 默认只给建议；有项目词表时才可升级为自动修复 | 高召回、可配置、默认不阻断 |
| `semantic-only` | 需要事实来源、接口 schema、上下文或完整话语逻辑 | 不自动修复 | 提供结构化缺口或外部模型/人工判断接口 |

「完全纯程序化」可以覆盖表面排版、固定词表、Markdown 结构、数字格式和部分 schema 驱动检查。事实保真、指代歧义、状态语义、恢复步骤完整性等不能仅靠规则保证。

## 3. 分类与元数据约定

### 3.1 判定分类

- `deterministic`：字符类别、保护区、AST、项目词表、固定映射和结构状态机可决定结果。
- `heuristic`：正则或分词必须先找候选，再由上下文、白名单、领域词或策略决定是否报告。
- `semantic-only`：程序只能检查必需字段、结构槽位或事实对照；最终正确性需要事实源、schema 或模型判断。

### 3.2 severity

沿用 stcn100 现有级别：

| severity | 使用场景 |
| --- | --- |
| `error` | 明确破坏渲染、复制、执行或项目硬规则；CI 默认失败 |
| `warning` | 高概率问题，需要上下文或项目配置确认 |
| `info` | 风格、结构或一致性建议，不默认阻断 |
| `off` | 项目关闭规则 |

补充原则：

- `deterministic` 不等于必须 `error`。项目约定冲突时仍可降级。
- `heuristic` 默认不得 `error`。除非项目词表把语境判定变成确定性规则。
- `semantic-only` 默认 `info` 或不提供诊断，只输出待确认字段。

### 3.3 fixability

| fixability | 含义 |
| --- | --- |
| `auto-safe` | 可生成精确字符区间修复，不改变事实、语气、代码和渲染语义 |
| `suggest` | 可给替换或改写建议，不直接写文件 |
| `none` | 不提供修复，只报告缺口或人工判断点 |

## 4. 冲突与保护边界

上游规则优先级可归纳为：

1. 保留事实、逻辑、限制、安全信息和法律含义。
2. 服从用户明确要求和目标项目约定。
3. 保持技术术语和机器可读内容准确。
4. 改善结构、语义、语气和可扫读性。
5. 最后处理标点、留白、大小写等排版细节。

stcn100 必须持久保护以下区域：

- 代码块、缩进代码、行内代码、命令、配置项、正则和占位符。
- URL、Markdown 链接目标、API 路径、JSON 键名、数据库字段名。
- 错误原文、枚举值、状态码、固定引用、法律文本和用户指定字面量。
- Markdown 标题、列表标记、表格结构、HTML 块、front matter 和显式硬换行。

冲突处理建议：

- 项目产品名、官方拼写、术语表和 schema 优先于通用词表。
- 「中文正文全角标点」不能覆盖代码、路径、英文原文和固定引用。
- 「中西文留白」不能修改 URL、代码、链接目标、版本字符串和机器可读标识符。
- 「一段一行」不能展开表格、代码、引用块、HTML 块和行尾显式换行。
- API 状态词不能固定一对一翻译；必须先确认 HTTP 状态、业务状态、任务状态和界面语义。
- 黑话词、被动句、第二人称、句长等只能作为提示，不能无条件失败。

## 5. 程序化规则清单

规则 ID 是 stcn100 建议命名，不来自上游。severity 和 fixability 是工程建议，项目覆盖配置可以放宽或收紧。

### 5.1 文件结构、保护区和段落

| 建议 ID | 规则 | 分类 | severity | fixability | 实现说明 |
| --- | --- | --- | --- | --- | --- |
| `internal/protected-region` | 保护代码、URL、路径、字段和固定字面量 | `deterministic` | `info` | `none` | 解析器基础设施，不是普通诊断；所有文本规则必须先做 span mask |
| `structure/disable-directive` | 支持行级/文件级忽略 | `deterministic` | `info` | `none` | 上游有 `copy-lint-disable-line` 和 `unwrap-disable-file`；stcn100 应统一指令 |
| `structure/markdown-container` | 保护标题、表格、引用、HTML、front matter 和列表结构 | `deterministic` | `error` | `none` | 用 Markdown source map；错误修复不得跨容器 |
| `structure/paragraph-hard-wrap` | 检测正文段落和列表项的手工硬换行 | `deterministic` | `warning` | `auto-safe` | 上游 `unwrap_md_paragraphs.py` 已实现结构扫描和拼接；显式硬换行除外 |
| `structure/topic-per-paragraph` | 一个段落一个主要信息点 | `heuristic` | `info` | `suggest` | 段落过长、主题词跳变、多个列表信号可提高召回 |
| `structure/list-parallel` | 同层列表句式、密度和标点一致 | `heuristic` | `info` | `suggest` | 需比较同级列表项；实现可调用形态分析和句子结构 |
| `structure/repeated-information` | 标题、正文、按钮和表格重复同一信息 | `heuristic` | `info` | `suggest` | 可用相似度、标题/正文映射和 UI 文案结构检测 |

### 5.2 术语、错词、大小写、黑话和称呼

| 建议 ID | 规则 | 分类 | severity | fixability | 实现说明 |
| --- | --- | --- | --- | --- | --- |
| `terminology/exact-typo` | 高置信度错词固定映射 | `deterministic` | `error` | `auto-safe` | 例如 `阀值→阈值`、`布署→部署`、`反回→返回`、`回朔→回溯`、`做为→作为` |
| `terminology/ai-typo` | AI 专有词固定映射 | `deterministic` | `warning` | `auto-safe` | 例如 `embeding→embedding`、`fine tune→fine-tuning`、`提示工程学→提示工程` |
| `terminology/preferred-case` | 通用技术缩写标准大小写 | `deterministic` | `warning` | `auto-safe` | 例如 `id→ID`、`api→API`、`json→JSON`、`url→URL`、`http→HTTP`、`ai→AI` |
| `terminology/project-case` | 项目产品名和官方拼写 | `deterministic` | `error` | `auto-safe` | 必须来自项目配置；覆盖通用映射 |
| `terminology/case-context` | 语境相关大小写或简称 | `heuristic` | `info` | `suggest` | 例如 `JS`、`H5`、`Postgres`、`OAuth`、`k8s`、`OAuth 2.0` |
| `terminology/consistency` | 同概念使用同一首选术语 | `heuristic` | `warning` | `suggest` | 项目词表可把它升级为确定性别名替换；必须先做词义消歧 |
| `terminology/context-word` | 语境词警示 | `heuristic` | `info` | `none` | 例如 `登录/登陆`、`配置/配制`、`截至/截止`、`启用/起用`、`标识/标示`、`认证/授权` |
| `terminology/black-talk` | 检测空泛黑话候选 | `heuristic` | `info` | `suggest` | 上游词表含 `赋能`、`抓手`、`闭环`、`沉淀`、`对齐`、`抓手`、`拉通`、`打通` 等；有业务定义时可豁免 |
| `terminology/contextual-jargon` | 检测依赖语境的业务热词 | `heuristic` | `info` | `none` | 例如 `场景`、`生态`、`体系`、`路径`、`触点`、`卡点`、`布局`、`矩阵`、`颗粒度`、`复盘` |
| `address/direct-reader` | 第二人称和称呼提示 | `heuristic` | `info` | `suggest` | 检测 `你`、`您`、`同学`；消费产品、帮助文本和品牌规范可允许 |
| `tone/promotional` | 宣传化、口号式和空泛程度词 | `heuristic` | `info` | `suggest` | 如连续堆叠黑话、感叹号、无法验证的速度/能力主张；不能自行补事实 |
| `tone/fact-modality` | `可能`、`计划`、`建议`、`通常` 等确定性变化 | `semantic-only` | `info` | `none` | 可用原稿/改写稿词表差异辅助，但最终需事实对照 |

### 5.3 标点、中西文留白、数字、单位和日期

| 建议 ID | 规则 | 分类 | severity | fixability | 实现说明 |
| --- | --- | --- | --- | --- | --- |
| `punctuation/quote-style` | 中文正文使用直角引号 `「」` | `deterministic` | `warning` | `auto-safe` | 可统一 ASCII 双引号和中文弯引号；固定引用、代码和项目规范除外 |
| `punctuation/nested-quote` | 嵌套引用使用 `『』` | `deterministic` | `warning` | `auto-safe` | 需要成对解析，不能只做全局替换 |
| `punctuation/full-width` | 中文正文使用全角标点 | `deterministic` | `warning` | `auto-safe` | 重点检查 `, ; : ! ? ( )` 与中文正文混用；代码、URL、英文句和表格结构除外 |
| `punctuation/spacing` | 全角标点前后不额外加空格 | `deterministic` | `error` | `auto-safe` | 例如 `API 、 SDK`、`命令行 。`；Markdown 缩进和表格分隔除外 |
| `punctuation/repeated` | 连续重复标点 | `deterministic` | `error` | `auto-safe` | 上游检测连续逗号、句号、分号、冒号、问号、叹号；保留一个即可 |
| `punctuation/ellipsis` | 中文省略号使用 `……` | `deterministic` | `warning` | `auto-safe` | `...`、`。。。` 等可定位；代码和引用除外 |
| `punctuation/dash` | 中文破折号使用 `——` | `deterministic` | `warning` | `auto-safe` | `--`、`—` 等先按上下文判断；代码选项和命令不处理 |
| `punctuation/paired` | 成对符号配对和嵌套 | `deterministic` | `error` | `none` | 括号、引号、书名号和角标可在块内平衡；跨块引用需要保守处理 |
| `punctuation/list-ending` | 同层列表句末形式一致 | `heuristic` | `info` | `suggest` | 完整句统一句号，短语型可统一无句号；列表内结构可以跨行 |
| `punctuation/colon-purpose` | 冒号后确有解释、列举或引用 | `heuristic` | `info` | `suggest` | 单行单独冒号、连续冒号、无内容冒号可高召回提示 |
| `punctuation/delimiter-clarity` | 破折号、括号、斜线不代替句子组织 | `semantic-only` | `info` | `none` | 可统计密度和嵌套，但关系是否明确需阅读 |
| `spacing/cjk-latin` | 中文与英文、缩写、数字和版本号间加一个半角空格 | `deterministic` | `warning` | `auto-safe` | 需要 CJK/Latin/digit 边界扫描；URL、代码、字段、链接目标和官方字面量除外 |
| `spacing/cjk-inline-code` | 中文与行内代码之间加一个半角空格 | `deterministic` | `warning` | `auto-safe` | 只调整代码标记外侧；紧邻中文标点时不加空格 |
| `spacing/link-display` | 链接按显示文字判断中西文边界 | `deterministic` | `warning` | `auto-safe` | 不修改链接语法和目标；中文链接文字与中文正文之间不额外加空格 |
| `spacing/duplicate-space` | 连续普通空格、全角空格或 Tab 模拟排版 | `heuristic` | `warning` | `auto-safe` | Markdown 缩进、表格对齐、行尾显式换行和代码区除外 |
| `number/unit-space` | 数字与半角单位符号之间加一个空格 | `deterministic` | `warning` | `auto-safe` | 例如 `10GB→10 GB`、`200ms→200 ms`；不换算单位 |
| `number/percent-degree-space` | 百分号和角度符号紧邻数字 | `deterministic` | `warning` | `auto-safe` | 例如 `50 %→50%`、`90 °→90°`；温度 `°C` 属于单位，需空格 |
| `number/sign-decimal-grouping` | 负号、小数点、千位分隔符不与数字分离 | `deterministic` | `warning` | `auto-safe` | 例如 `- 3.5→-3.5`；科学计数法、范围和代码值除外 |
| `number/range-style` | 中文正文数值范围优先使用 `至` | `heuristic` | `info` | `suggest` | `3-5 天` 可提示 `3 至 5 天`；版本、技术范围、代码和固定公式除外 |
| `date/cjk-format` | 中文日期使用 `YYYY 年 M 月 D 日` | `deterministic` | `warning` | `auto-safe` | 只规范排版，不补年份、不猜测日期 |
| `date/clock-format` | 数字时间内部不加空格 | `deterministic` | `warning` | `auto-safe` | 例如 `15 : 30→15:30`；不补时区 |
| `date/timezone` | 跨时区内容包含已知时区 | `heuristic` | `warning` | `suggest` | 检查器应提示补时区，不得根据所在地猜测 |
| `number/unit-required` | 数值带必要单位或量纲 | `semantic-only` | `info` | `none` | 可从列名/参数 schema 检查缺失率；单位是否正确需事实源 |
| `number/percentage-vs-point` | 百分比与百分点不混用 | `heuristic` | `warning` | `suggest` | 需要基数和前后值；缺少基数时输出待确认 |
| `number/quantity-magnitude` | 数量倍数和上下界逻辑 | `deterministic` | `error` | `suggest` | 例如 `缩小了 3 倍`、`不超过 100 以上`、`翻了 1 倍`、`预计大约在 3 点左右` |
| `number/percentage-baseline` | 增长、提升、转化率的相对基数和口径 | `semantic-only` | `info` | `none` | 需要原值、目标值、时间窗和业务口径，不能自行补充 |
| `number/fact-preservation` | 不增删数字、日期、单位、精度和范围 | `semantic-only` | `error` | `none` | 可通过原文/改写稿 token diff 强化审计，但不能单独证明语义正确 |

### 5.4 段落硬换行与句子结构

| 建议 ID | 规则 | 分类 | severity | fixability | 实现说明 |
| --- | --- | --- | --- | --- | --- |
| `sentence/length` | 句长超过建议或硬上限 | `heuristic` | `warning` | `suggest` | 计数需定义：汉字、拉丁词、数字和标点权重；不能按字符粗暴判断 |
| `sentence/clause-stack` | 单句堆叠过多条件、动作和例外 | `heuristic` | `warning` | `suggest` | 分句计数、连接词、动作词可提高召回；拆分需保持条件、否定和因果 |
| `sentence/passive` | 被动表达是否降低执行清晰度 | `heuristic` | `info` | `suggest` | 检测 `被`、`由...所`、`受到`、`得以`；中文被动并非绝对错误 |
| `sentence/action-nominalization` | 空动词结构 | `heuristic` | `warning` | `suggest` | 如 `进行 + 动作名词`；删除空动词时需保留原有宾语结构 |
| `sentence/future-tense` | 文档中无必要的将来表达 | `heuristic` | `info` | `suggest` | 如 `将会`、`将要`、`届时将`；需判断真实未来行为 |
| `sentence/possibility-language` | `可能`、`也许`、`大概` 缺少条件或影响 | `heuristic` | `info` | `suggest` | 需补充触发条件、概率、影响或替代结果；不能自行补事实 |
| `sentence/redundant-connective` | 因果、转折、假设连接词冗余 | `heuristic` | `info` | `suggest` | 如 `因为...所以`、`由于...因此`；删除哪一部分取决于语义 |
| `reference/ambiguous-pronoun` | `该`、`其`、`此`、`上述` 等指代不清 | `heuristic` | `warning` | `none` | 可检测候选，但目标是否明确需阅读上下文 |
| `reference/term-consistency` | 后文未沿用首次定义的首选术语 | `heuristic` | `warning` | `suggest` | 项目词表可转成确定性；需处理同形异义和引用 |
| `sentence/action-object` | 动作有明确对象和结果 | `semantic-only` | `warning` | `none` | 可检查动词宾语缺失，无法判断对象是否正确 |
| `sentence/logical-order` | 原因、现象、操作和结果不混写 | `semantic-only` | `info` | `none` | 依赖话语结构和领域流程 |

### 5.5 API、界面和入口文案

| 建议 ID | 规则 | 分类 | severity | fixability | 实现说明 |
| --- | --- | --- | --- | --- | --- |
| `api/machine-readable-preservation` | 状态码、枚举、字段名、路径和响应原文保持原样 | `deterministic` | `error` | `none` | 必须先用 schema 或代码 span 建立保护区 |
| `api/status-semantic-map` | 英文状态词按实际接口语义翻译 | `semantic-only` | `warning` | `none` | 不能固定把 `Invalid` 翻译为「非法」或把 `Unauthorized` 翻译为「未授权」 |
| `api/status-context-ambiguity` | 同一英文状态的接口中文映射依赖上下文 | `semantic-only` | `info` | `none` | 需要 HTTP、业务状态、任务状态和 UI 提示上下文 |
| `api/parameter-contract` | 参数写清类型、格式、必填、单位、默认值、范围、缺省和依赖 | `heuristic` | `warning` | `suggest` | 有 OpenAPI/JSON Schema 时可升级为部分 `deterministic`；否则按表格列检查 |
| `api/parameter-vague-copy` | 禁止 `正常值`、`根据情况填写`、`相关信息` 等不可执行说明 | `heuristic` | `warning` | `suggest` | 固定短语可高精度检测，替换内容需 schema |
| `api/error-structure` | 错误文案包含问题、对象、原因、恢复和诊断信息 | `heuristic` | `warning` | `suggest` | 可按槽位检查；缺失槽位不一定违规，但应提示待确认 |
| `api/error-recovery` | 恢复步骤正确、可执行且不承诺未知时限 | `semantic-only` | `warning` | `none` | 需要接口行为和失败模式事实源 |
| `api/error-cause-certainty` | 不得把待核实原因写成确定原因 | `semantic-only` | `warning` | `none` | 可检测 `可能是`、`一定是` 等词变化，但事实仍要核对 |
| `api/state-distinction` | 区分请求失败、认证失败、权限不足、资源不存在和状态冲突 | `semantic-only` | `warning` | `none` | 需要状态码、业务错误码和产品定义 |
| `ui/button-label` | 按钮说明动作和目标，不重复页面标题 | `heuristic` | `info` | `suggest` | 可用标题/按钮相似度和动作词典；最终需界面语境 |
| `ui/error-copy` | 界面错误提示说明问题、影响和恢复方式 | `heuristic` | `warning` | `suggest` | 与 `api/error-structure` 共享槽位模型 |
| `ui/destructive-action` | 危险操作写清对象、后果和是否可撤销 | `semantic-only` | `warning` | `none` | 可检测危险操作词和撤销词，但对象与后果需产品事实 |
| `ui/empty-state` | 区分无数据、未创建、无权限和加载失败 | `semantic-only` | `warning` | `none` | 需要页面状态和权限模型 |
| `entry/first-paragraph` | 首段回答覆盖什么、适合谁、从哪里开始 | `heuristic` | `info` | `suggest` | 可检查首段槽位和标题重复，不能保证事实完整 |

### 5.6 受控中文技术写作

| 建议 ID | 规则 | 分类 | severity | fixability | 实现说明 |
| --- | --- | --- | --- | --- | --- |
| `controlled/document-scope` | 完整应用、选择性应用、不机械应用 | `deterministic` | `info` | `none` | 由项目配置按文件路径、内容类型或 front matter 选择预设 |
| `controlled/preserve-facts` | 不新增或删除数字、日期、能力、条件、例外和结论 | `semantic-only` | `error` | `none` | 可做实体和确定性词 diff，但必须对照事实源 |
| `controlled/one-primary-action` | 一个步骤一个主要动作 | `heuristic` | `warning` | `suggest` | 可检测连动、并列动词和过长步骤；同时动作在部分流程中合法 |
| `controlled/condition-before-action` | 条件和风险先于动作 | `heuristic` | `warning` | `suggest` | `如果...`、前置条件、警告和步骤顺序可部分结构化 |
| `controlled/actor-clarity` | 明确执行者、对象和结果 | `semantic-only` | `warning` | `none` | 可检查主语缺失和角色词，但自动行为与人工行为需语义判断 |
| `controlled/action-boundary` | 有条件、否定和因果关系时不过度拆句 | `semantic-only` | `warning` | `none` | 必须保留否定范围、条件和因果 |
| `controlled/logical-order` | 操作、排查和恢复按实际执行顺序排列 | `semantic-only` | `warning` | `none` | 需要流程、依赖和风险事实 |
| `controlled/troubleshooting-structure` | 故障排查包含现象、证据、检查、判断、原因、恢复和停止条件 | `heuristic` | `warning` | `suggest` | 可按标题和字段槽位检查；内容真实性不在规则内 |
| `controlled/uncertainty` | 保留 `可能`、`建议`、`通常`、`计划` 等确定程度 | `semantic-only` | `warning` | `none` | 词表 diff 可辅助，不能证明事实未变化 |
| `controlled/over-simplification` | 不因短句删除限制、失败处理和例外 | `semantic-only` | `error` | `none` | 需要原文/改写稿结构对照 |
| `controlled/content-type-exclusion` | 品牌文案、叙事、法律原文和固定引用不机械套用 | `deterministic` | `info` | `none` | 项目配置、front matter 或路径规则决定预设 |

## 6. 上游现有程序化能力

### 6.1 `lint_copy_rules.py`

已实现的规则：

| 上游规则 | 当前判定 | stcn100 对应建议 |
| --- | --- | --- |
| 保护 front matter、围栏代码、缩进代码、多行行内代码、URL、链接目标、API 路径和 HTML 属性 | `deterministic` | `internal/protected-region` |
| ASCII 双引号、中文弯引号 | `style` | `punctuation/quote-style` |
| `你`、`您`、`同学` | `style` | `address/direct-reader` |
| `id`、`http`、`url`、`json`、`api`、`ai` 大小写 | `style` | `terminology/preferred-case` |
| `JS`、`H5` | `style` | `terminology/case-context` |
| AI 词映射 | `warning` | `terminology/ai-typo` |
| 高置信度错词 | `error` | `terminology/exact-typo` |
| 语境词和 `即时+技术名词` | `warning` | `terminology/context-word` |
| 行级忽略指令 | `deterministic` | `structure/disable-directive` |

上游尚未程序化的规范：

- 黑话词表未进入 linter，虽然 `terminology-and-typography.md` 已列出大量候选。
- 未检查中文逗号、句号、分号、冒号、问号、叹号宽度和全角标点周边空格。
- 未检查省略号、破折号、成对符号和列表句末一致性。
- 未检查一般中西文留白，只在段落展开时处理拼接边界。
- 未检查数字、单位、百分比、角度、日期、时间和数量逻辑。
- 未集成段落硬换行检查，`unwrap_md_paragraphs.py` 是独立工具。
- 未做跨文件术语一致性、缩写首次定义和项目术语表。
- API 状态、错误文案、参数契约、受控中文语义仍由 Agent/人工执行。

### 6.2 `unwrap_md_paragraphs.py`

已实现的能力：

- 识别正文段落和列表项硬换行，默认展开为一段一行，`--check` 只检查。
- 保护 front matter、围栏代码、列表标记后的围栏、缩进代码、多行行内代码、表格、标题、Setext、分隔线、链接和脚注引用定义、引用块、HTML 块、`pre/script/style/textarea` 和 HTML 注释。
- 保留行尾两个空格或反斜杠表示的显式换行。
- 拼接边界按中西文类型、全角标点、ASCII 标点、行内强调和链接显示文字补充空格。
- 支持 `unwrap-disable-file` 文件级跳过。

已知简化来自脚本注释：

- 不进入引用块内部做拼接。
- 列表标记后超过四个空格时仍按标记前缀处理。
- 未闭合围栏延伸到所属列表项结束或文件末尾。

因此，stcn100 应把该工具的能力整合到统一解析层，而不是长期维护两个独立 Markdown 状态机。

## 7. 分词与语言基础设施建议

需要分词，但不是所有规则都该依赖分词。

### 7.1 不需要分词的部分

- 代码、URL、路径和 Markdown 保护区：用 AST/source span。
- 标点宽度、连续标点、省略号、破折号和固定错词：用字符分类、正则和词典。
- CJK/Latin/digit 留白：用 Unicode 字符类别和上下文边界。
- 数字、单位、日期、时间：用数值 tokenizer 和模板。
- 段落硬换行：用 Markdown 块扫描器。

### 7.2 需要分词或词典的部分

- 术语一致性、黑话、业务热词、语境词和指代候选。
- 动作名词、被动、连接词、条件、步骤和句子结构。
- 项目术语表、缩写别名和跨文件索引。

Node.js 22 已有 `Intl.Segmenter`，可直接作为基线：

```ts
const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
const tokens = [...segmenter.segment(text)].map((item) => item.segment);
```

但内置分词不等于领域词典。例如本机实测：

```text
使用API获取数据并布署服务
-> 使用 | API | 获取 | 数据 | 并 | 布 | 署 | 服务
```

分词器把 `布署` 拆成两个 token，不能靠分词发现错词。正确顺序是：

1. 先屏蔽保护区。
2. 先跑固定错词和项目词表。
3. 再做分词、形态和上下文启发式。
4. 最后跑句子、段落和跨文件一致性。

建议定义独立接口：

```ts
interface ChineseTokenizer {
  segment(text: string): Token[];
}
```

默认实现用 `Intl.Segmenter` 和项目词典；项目需要 POS 或领域词表增强时，再接 `jieba` 的 Node/WASM 实现，但不要绑定单一库。确定性规则应优先依赖字符边界、词表和 AST，而不是依赖某个分词器版本。

## 8. 推荐迭代顺序

### P0：统一解析与修复安全

- 建立 source span、保护区、Markdown 容器和统一 ignore 指令。
- 把 hard-wrap scanner 和 lint parser 合并为同一解析管线。
- 所有 fix 必须用区间替换，测试不得改动代码、URL、字段和引用。

### P1：确定性高频规则

- 错词、AI 词、产品名、大小写、引号、连续标点、省略号、破折号。
- 全角标点周边空格、CJK/Latin/digit 留白、行内代码和链接边界。
- 数字单位、百分比、角度、日期、时间、数量和明显逻辑矛盾。

### P2：项目词表与一致性

- 项目术语表、别名、缩写、禁用词、允许例外和官方拼写。
- 跨文件术语一致性、首次定义和同形异义处理。
- 黑话和语境词仅在项目配置明确时升级严重级别。

### P3：结构与启发式

- 句长、分句、被动、动作名词、将来表达、可能性表达和指代候选。
- 段落主题、列表平行、标题、入口页和 UI 文案槽位。
- 输出建议，不默认自动修复。

### P4：Schema 与语义审计

- OpenAPI/JSON Schema 参数契约检查。
- API 状态、错误码、恢复步骤和事实保真对照。
- 外部模型或人工审阅作为可选插件，不让核心规则依赖模型。

## 9. 对「找出所有潜在违反规则」的工程边界

可以高置信程序化：

- 表面排版和固定词表。
- Markdown 结构、保护区和段落硬换行。
- 数字、单位、日期和固定逻辑矛盾的局部模式。
- 有项目词表或 API schema 的一致性检查。

可以高召回但不能保证不误报：

- 黑话、语境词、称呼、句长、被动、动作名词和指代。
- 列表平行、段落主题、错误文案槽位和参数字段完整度。

不能仅靠规则证明：

- 事实、数字、条件、因果和确定性程度是否保持。
- API 状态词的真实语义、恢复步骤是否正确。
- 执行者、对象、结果、危险操作后果和空状态原因是否正确。
- 改写是否遗漏例外、限制、失败处理或法律含义。

stcn100 的目标应定为：所有可机械判断的规则完全程序化；所有启发式规则高召回、可解释、可配置；所有语义规则明确标记不可自动证明，而不是伪装成完整检查。

## 10. 来源

上游主仓库：

- [Repository](https://github.com/Fenng/Tech-Doc-Style-Chinese)
- [Fixed commit](https://github.com/Fenng/Tech-Doc-Style-Chinese/tree/726bb3e2cbb97cc6086533b410f46779d3c1028b)
- [LICENSE](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/LICENSE)

规范和路由：

- [README.md](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/README.md)
- [SKILL.md: rule priority](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/SKILL.md#L21)
- [SKILL.md: fact preservation](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/SKILL.md#L33)
- [SKILL.md: structure and terminology](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/SKILL.md#L80)
- [SKILL.md: API and UI](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/SKILL.md#L113)
- [NoCode-Skill.md](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/NoCode-Skill.md)

详细规则：

- [术语与排版：术语](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/references/terminology-and-typography.md#L5)
- [术语与排版：黑话](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/references/terminology-and-typography.md#L13)
- [术语与排版：标点](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/references/terminology-and-typography.md#L70)
- [术语与排版：称呼](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/references/terminology-and-typography.md#L96)
- [术语与排版：中西文留白](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/references/terminology-and-typography.md#L102)
- [术语与排版：数字、单位与日期](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/references/terminology-and-typography.md#L136)
- [术语与排版：段落硬换行](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/references/terminology-and-typography.md#L165)
- [术语与排版：技术术语大小写](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/references/terminology-and-typography.md#L197)
- [术语与排版：错词与语境词](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/references/terminology-and-typography.md#L234)
- [术语与排版：数量与逻辑](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/references/terminology-and-typography.md#L256)
- [API 状态与错误文案](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/references/api-status-copy.md)
- [受控中文技术写作](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/references/controlled-technical-chinese.md#L41)
- [受控中文自动检查边界](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/references/controlled-technical-chinese.md#L267)
- [项目覆盖模板](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/references/project-overrides-example.md)

实现：

- [lint_copy_rules.py](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/scripts/lint_copy_rules.py#L224)
- [unwrap_md_paragraphs.py](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/scripts/unwrap_md_paragraphs.py#L296)
- [lint tests](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/tests/test_lint_copy_rules.py)
- [unwrap tests](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/tests/test_unwrap_md_paragraphs.py)
- [CI workflow](https://github.com/Fenng/Tech-Doc-Style-Chinese/blob/726bb3e2cbb97cc6086533b410f46779d3c1028b/.github/workflows/skill-lint.yml)

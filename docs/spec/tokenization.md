# 中文分词与 Tokenizer 规范

> 调研快照：2026-10-04。运行时复核：Node.js `22.17.0`、ICU `77.1`、CLDR `47.0`、pnpm `10.12.4`。
>
> 核心 `Tokenizer` 协议和默认 `IntlWordTokenizer` 已接入源码；jieba 适配器仍为下一阶段工作。

## 1. 推荐决策

1. 需要中文分词，但不能让所有规则依赖分词。
2. 默认实现采用 `Intl.Segmenter("zh-CN", { granularity: "word" })`，加项目词表覆盖层。
3. 生产环境需要更高准确率、POS 和领域词典时，可选接入 `@node-rs/jieba`。
4. 浏览器、Deno 或禁止原生扩展的场景，可选 `jieba-wasm`。
5. 不把 `segmentit` 和 `nodejieba` 作为新默认依赖。前者维护停滞且 Node ESM 兼容差；后者安装重、全局状态和 CI 风险高。
6. Tokenizer 必须统一输出 JavaScript UTF-16 半开区间 `[start, end)`，保证无损覆盖、稳定排序和原始偏移。
7. 固定错词、标点、数字、单位、Markdown 结构不依赖分词。分词只服务词边界、词性、术语和上下文候选。
8. 默认包不引入原生模块。jieba 适配器独立发包或作为显式可选依赖加载，不复制进核心运行时。

结论：stcn100 的基线应是“无原生依赖的确定性字符/词典层 + 可替换分词层”，不是绑定某个 jieba 实现。

## 2. 需求边界

stcn100 需要同时满足：

- Node.js 22+、TypeScript、ESM 优先。
- Windows、Linux、macOS 本地开发一致。
- GitHub Actions 不依赖 C++ 工具链。
- 可安装体积可控。
- 分词器可替换、可缓存、可释放。
- 支持项目术语表、行业词、产品词和编码标识符。
- 可选词性，但不把词性当语法真值。
- 诊断和修复使用原文字符偏移，不受 Markdown 掩码、CRLF、emoji、代理对影响。
- 默认行为稳定；升级分词器不能静默改变规则结论。

### 2.1 不依赖分词

以下规则优先使用字符分类、正则、词表和结构解析：

- Markdown 硬换行、标题层级、列表、表格和引用。
- 连续标点、标点宽度、省略号、破折号。
- CJK/Latin 留白。
- 数字、单位、日期、时间、百分比、范围和缩写。
- 固定错词、禁用词、大小写和机器标识符。
- 句长、分句数、段落句数。

### 2.2 需要分词或词典

以下规则需要词边界候选，部分规则还需要 POS：

- 术语一致性、黑话、业务热词和语境词。
- 被动候选。
- 空动词或动作名词结构。
- 多词名词和长名词簇。
- 条件、连接、步骤和并列动作。
- 指代候选和跨句上下文。
- 项目词表、缩写、别名和首次定义索引。

### 2.3 完全程序化检测的含义

“程序化”不等于“程序能确定所有语义违规”。稳定方案分三层：

| 层级 | 输出 | 典型规则 |
| --- | --- | --- |
| `deterministic` | 确定违规，可安全修复或确定性报错 | 固定错词、连续标点、标点宽度、术语别名 |
| `heuristic` | 可复现候选，需要上下文、术语库或白名单 | 被动、动作名词、黑话、长名词簇 |
| `semantic` | 只能给候选或复核项，不能保证语义等价 | 指代是否明确、因果是否成立、风险是否充分 |

要求是“所有可疑位置都可由程序定位并给证据”，不是“所有语义问题都能由程序无人工确认地判定”。`semantic` 规则也必须输出稳定 span、规则 ID、置信度和解释。

## 3. 方案对比

### 3.1 总表

| 方案 | 准确性 | 词典扩展 | POS | 维护 | npm 解包体积 | 原生依赖 | Windows / CI | Node ESM / TS | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `Intl.Segmenter` | 通用中文基线；领域词弱 | 本身不支持，可做覆盖层 | 无 | 跟 Node/ICU/CLDR 演进 | `0` 包体积，使用 Node 内置 ICU | 无额外模块 | 最稳 | 内置 API；TypeScript 库类型可用 | 默认基线 |
| `@node-rs/jieba@2.0.3` | jieba-rs 词典 + HMM；通用和领域词较强 | `loadDict` 可增量合并，实例级 | `tag()` | 2026-09 发布，napi-rs 活跃 | 主包约 `10.79 MiB`；Windows x64 二进制约 `2.52 MiB`；合计约 `13.32 MiB` | N-API 预编译二进制 | 支持平台无需编译器；可选依赖缺失会加载失败 | 命名导入可用；`/dict` 子路径必须写 `.js`；有 `.d.ts` | jieba 首选适配器 |
| `segmentit@2.0.3` | 旧盘古词典，普通文本尚可；技术词不稳定 | `loadDict(word\|posNumber\|freq)`，实例级 | 数字位掩码 + 中英文标签 | npm 版本停在 2019，维护停滞 | 约 `15.02 MiB` | 无 | 安装简单，但旧构建链无人维护 | CJS 优先；Node 22 `import { Segment }` 失败，只能默认导入或 require；无 TS 类型 | 不推荐新接入 |
| `jieba-wasm@2.4.0` | 与 jieba-rs 同源，整体较强 | `add_word`、`with_dict`，进程全局状态 | `tag()` | 2025-09 发布 | 完整包约 `15.38 MiB`；Node 目标目录约 `3.84 MiB` | WASM | 无编译链；实例化有启动成本 | 根导出可用，内部仍走 Node CJS 目标；有 `.d.ts` | 可移植备选 |
| `nodejieba@3.5.8` | cppjieba，通用分词和 POS 成熟 | `load` 用户词典、`insertWord`，进程全局状态 | `tag()` | 2026-03 发布 | npm 解包约 `19.90 MiB`；Windows 安装后实测约 `42.46 MiB` | C++ / N-API 预编译下载，失败时回退 node-gyp | 网络、代理和构建工具风险高 | CJS；ESM 只能默认导入；有 `.d.ts` | 仅兼容旧用户 |

### 3.2 安装体积说明

体积来自 2026-10-04 npm registry 元数据与本机 Windows x64 实测，使用 MiB：

| 包 | registry `dist.unpackedSize` | 本机安装额外事实 |
| --- | ---: | --- |
| `@node-rs/jieba` | `11,316,129` bytes | 另有 `@node-rs/jieba-win32-x64-msvc` 二进制约 `2.52 MiB` |
| `segmentit` | `15,754,748` bytes | 包含 CJS、ESM、UMD 三套产物和内联词典 |
| `jieba-wasm` | `16,126,591` bytes | 包含 node、web、deno、bundler 四套产物 |
| `nodejieba` | `20,866,671` bytes | 安装脚本下载/编译后可膨胀到约 `42.46 MiB` |

`Intl.Segmenter` 没有 npm 包体积，但依赖 Node 构建带的 ICU/CLDR 数据。官方 Node 默认包含 full ICU；裁剪版 Node 或 `small-icu` 构建必须启动时检查 `Intl.Segmenter.supportedLocalesOf(["zh-CN"])`，不能静默退化成英文空格分词。

### 3.3 本机分词样例

以下为各库默认词典、未加自定义词，输入均为 Node.js 22.17.0：

| 输入 | `Intl.Segmenter` | `@node-rs/jieba` | `segmentit` | `jieba-wasm` | `nodejieba` |
| --- | --- | --- | --- | --- | --- |
| `南京市长江大桥` | `南京市/长江/大/桥` | `南京市/长江大桥` | `南京市/长江/大桥` | `南京市/长江大桥` | `南京市/长江大桥` |
| `风控网关处理配置` | `风/控/网/关/处理/配置` | `风/控/网关/处理/配置` | `风控/网关/处理/配置` | `风控/网关/处理/配置` | `风/控/网关/处理/配置` |
| `使用API获取数据并布署服务` | `使用/API/获取/数据/并/布/署/服务` | `使用/API/获取数据/并/布署/服务` | `使用/API/获取/数据/并/布署/服务` | `使用/API/获取数据/并/布署/服务` | `使用/A/P/I/获取数据/并/布署/服务` |

这些样例不是权威准确率基准，只说明两件事：

- `Intl.Segmenter` 能满足通用词边界，但技术词和固定术语必须靠项目词典补强。
- 不同 jieba 绑定的词典、英文处理、HMM 和词典权重并不完全一致，接口层不能假设可互换结果。

### 3.4 维护和风险细节

`Intl.Segmenter`：

- Node 22 已正式可用，Baseline 2024。
- 返回 `segment`、`index` 和 `isWordLike`；`index` 是 JavaScript UTF-16 偏移。
- 不能加载用户词，不能给 POS，不能保证固定分词版本。
- ICU/CLDR 升级可能改变边界。必须保存 gzip、快照测试和版本兼容测试。
- 适合默认基线，不适合直接承担术语治理。

`@node-rs/jieba`：

- jieba-rs 的 Rust/N-API 绑定，官方 README 声明不需要 node-gyp。
- 提供 `cut`、`cutAll`、`cutForSearch`、`cutAsync`、`tag`。
- 默认词典加载后可继续 `loadDict(Buffer.from("词 频次 词性"))` 增量合并。
- `Jieba` 实例有独立词典状态，优于进程全局词典方案。
- `cut` 和 `tag` 只返回词，不返回 span；适配器必须无损重建偏移并校验。
- 包没有 `exports` 映射。Node 22 ESM 中 `@node-rs/jieba/dict` 解析失败，必须使用 `@node-rs/jieba/dict.js`。
- 平台二进制是 optional dependency。pnpm/npm 锁文件、跨平台部署、Docker 多阶段构建和 `--no-optional` 都要测试；缺失时明确报 fatal，不静默换分词器。
- CLI 默认同步规则接口可使用同步 `cut/tag`；`cutAsync` 要等规则引擎支持异步或放入 worker。

`segmentit`：

- 纯 JS、无原生依赖，浏览器和 Electron 友好。
- 支持 POS、同义词、停用词和自定义词典。
- npm 最新版本 `2.0.3` 发布于 2019；代码内仍是 Flow、旧 Babel/Rollup 和 Travis 配置。
- 包声明 `module`，但没有 `exports` 和 `"type": "module"`。Node 22 ESM 会解析到 CJS，具名导入 `Segment` 实测失败。
- 没有 TypeScript 声明；TS 使用会得到隐式 `any` 或需要自建声明。
- `doSegment` 按换行分段并 `trim()`，原位置丢失；不能直接用于诊断 span。
- 自定义词典格式是 `词|POS 数字|频次`，不是通用 UTF-8 词表格式。
- 只适合维护兼容适配器，不适合纳入默认依赖。

`jieba-wasm`：

- `jieba-rs` WASM 绑定，无原生 ABI，Node、浏览器和 Deno 路径明确。
- 支持 `cut`、`cut_all`、`cut_for_search`、`tag`、`add_word`、`with_dict`。
- `tokenize` 原生返回 `{ word, start, end }`，但 `start/end` 是 Unicode code point 偏移。对 `用户🙂配置。`，emoji 返回 `2..3`，JavaScript UTF-16 中实际是 `2..4`。适配器必须建立 code point 到 UTF-16 的映射，不能把原值直接交给诊断。
- `add_word` 和 `with_dict` 改改进程级词典状态，多项目、多配置并发时危险。每个进程只初始化一次，或放入 worker。
- 完整 npm 包包含四套目标产物，默认安装比 Node 单目标需要更大。
- 适合作为便携适配器，不作为 Node CLI 默认。

`nodejieba`：

- cppjieba 原生绑定，功能完整，支持 POS、用户词典和动态加词。
- `install` 脚本依赖 `@mapbox/node-pre-gyp install --fallback-to-build`；预编译包不可用时触发本地编译。
- Windows 本机 Node 22 可以安装和加载，但企业代理、GitHub Release 限速、`--ignore-scripts`、离线 CI 会失败。
- npm 解包体积已经较大，安装后包含重复词典、对象文件和运行产物。
- 不返回原始 token span，词典和加载状态是进程全局。
- `index.js` 直接给未声明的 `dict`、`hmmDict`、`userDict` 等变量赋值，并有全局状态风险；不适合作为长驻多配置服务的基础层。
- 只有已有系统必须保持 cppjieba 行为时才接兼容适配器。

## 4. 可插拔 Tokenizer API

核心包只定义协议，不依赖任何具体分词库。建议协议如下：

```ts
export type TokenKind =
  | "word"
  | "number"
  | "punctuation"
  | "space"
  | "symbol"
  | "unknown";

export interface Token {
  /** 原文切片。必须满足 text.slice(start, end) === token.text。 */
  text: string;
  /** JavaScript UTF-16 半开区间起点。 */
  start: number;
  /** JavaScript UTF-16 半开区间终点。 */
  end: number;
  kind: TokenKind;
  /** 原始词性标签。不同实现不能假设标签体系相同。 */
  pos?: string;
  /** 产生该 token 的适配器。 */
  source?: string;
}

export interface TokenizerCapabilities {
  /** 能加载项目词表或用户词典。 */
  customDictionary: boolean;
  /** token.pos 可用。 */
  partOfSpeech: boolean;
  /** 输出覆盖完整输入且可无损重组。 */
  lossless: boolean;
  /** 词性标签体系，例如 jieba、segmentit 或 intl-none。 */
  posScheme?: string;
}

export interface TokenizerInitOptions {
  locale?: string;
  dictionary?: string[];
  signal?: AbortSignal;
}

export interface Tokenizer {
  readonly name: string;
  readonly capabilities: TokenizerCapabilities;
  initialize?(options?: TokenizerInitOptions): Promise<void>;
  tokenize(text: string): Token[];
  dispose?(): void;
}

export type TokenizerFactory = (
  options?: TokenizerInitOptions
) => Promise<Tokenizer>;
```

### 4.0 当前实现

当前 `@stcn100/core` 已实现最小协议：

- `Tokenizer.name`
- `Tokenizer.tokenize(text)`
- `Token.text/start/end/kind/pos?`
- `IntlWordTokenizer`
- `defaultTokenizer`

`capabilities`、异步 `initialize()`、`dispose()` 和 jieba 适配包保留为后续扩展。

### 4.1 契约

1. `start` 和 `end` 永远是 JavaScript UTF-16 下标，不是字节、Unicode scalar 或 display column。
2. 默认必须满足 `[start, end)` 半开区间、`token.text === input.slice(start, end)`、`tokens.map(t => t.text).join("") === input`。
3. token 必须按 `start` 升序，不得重叠；相邻 token 的 `end` 必须等于下一个 `start`。
4. 空输入返回空数组。未知字符返回 `unknown` 或 `symbol`，不得抛错或吞掉字符。
5. `initialize` 只在 lint 开始前调用一次。`tokenize` 在初始化完成后同步执行，避免规则 API 变成异步。
6. `pos` 是可选增强，不是规则正确性的硬依赖。需要 POS 的规则必须声明 capability，并在不可用时降级或跳过。
7. 适配器不能修改全局 `Intl`、原型、process 全局变量或其他 tokenizer 实例状态。
8. 词表变更必须走 `initialize` 或重建实例，不能在文档处理中热更新。

### 4.2 保护区顺序

Tokenizer 只接收 `TextBlock.analysisText`，绝不能接收未屏蔽源码：

```text
source text
  -> Markdown/文本解析
  -> frontmatter、代码、URL、HTML、链接目标等替换为等长掩码
  -> TextBlock.analysisText
  -> tokenizer
  -> Diagnostic 使用 TextBlock 原 range 映射回 source
```

禁止先分词再屏蔽，因为 URL、代码和路径会污染词典、POS 和边界。掩码必须等长，保证 token span 能直接映射回原文。

### 4.3 项目词表覆盖层

`Intl.Segmenter` 不支持用户词典。默认实现应由两个可组合部件组成：

```ts
interface LexiconEntry {
  term: string;
  caseSensitive?: boolean;
  pos?: string;
}

class LexiconOverlayTokenizer implements Tokenizer {
  constructor(
    private readonly base: Tokenizer,
    private readonly entries: LexiconEntry[]
  ) {}
  // 先做最长匹配，再合并边界，最后对空隙调用 base.tokenize
}
```

覆盖层规则：

- 项目词表优先于基础分词器。
- 同一位置命中多个词时，按最长词优先；仍相同则按配置顺序。
- 词表命中产生不可再切的 `word` token。
- 词表外区间继续调用基础 tokenizer，保证全输入无损覆盖。
- 词表匹配使用 trie、Aho-Corasick 或等价索引，不能对每个词全量扫描正文。
- 大小写敏感、全半角、边界和别名由词表配置决定，不能偷偷做全局 lowercase。

## 5. 默认实现

默认 tokenizer 命名为 `intl-word`，能力声明为：

```ts
const defaultTokenizer: Tokenizer = {
  name: "intl-word",
  capabilities: {
    customDictionary: false,
    partOfSpeech: false,
    lossless: true
  },
  tokenize(input: string): Token[] {
    const segmenter = new Intl.Segmenter("zh-CN", {
      granularity: "word"
    });
    return [...segmenter.segment(input)].map((item) => ({
      text: item.segment,
      start: item.index,
      end: item.index + item.segment.length,
      kind: classify(item),
      source: "intl-word"
    }));
  }
};
```

工程实现要求：

- `Intl.Segmenter` 实例复用，不在每个 token 或每个段落重新创建。
- `classify` 至少区分 `word`、`number`、`punctuation`、`space`、`symbol`。
- 数字和单位规则不应只依赖 `wordLike`；用专用字符/数值解析器。
- 启动时检查 `supportedLocalesOf(["zh-CN"])`。不支持时抛配置错误，不静默切换 locale。
- 默认词表以配置数据加载，核心不硬编码项目术语。
- 规则使用 token 时同时保留原 `start/end`，不根据 token 数组下标反推位置。

选择 `intl-word` 的理由：

- Node 22 已有，默认安装无新依赖和原生风险。
- Windows、Docker、GitHub Actions 行为一致，除 ICU 版本差异。
- 足够支持字符边界、词表覆盖、简单词窗口和候选规则。
- 技术文档的硬约束主要来自固定词表、AST、标点和结构，不依赖高质量 HMM。
- 可先交付稳定 CLI，再按项目开启更高准确率的适配器。

默认实现的局限：

- `风控网关`、产品名、缩略语和不常见行业词可能被切碎。
- 没有 POS，被动和动作名词只能使用固定模式。
- ICU 升级可能改变边界，必须有快照测试。
- 对“布署”这类错词，必须先跑固定错词表；分词结果不能证明词义正确。

## 6. `@node-rs/jieba` 可选适配器

### 6.1 发包边界

建议独立包：`@stcn100/tokenizer-jieba`。

- `@stcn100/core` 只包含 `Tokenizer` 协议。
- `@stcn100/tokenizer-jieba` 把 `@node-rs/jieba` 声明为 optional peer dependency 或 optional dependency。
- CLI 默认不加载该包。
- 用户配置 `tokenizer: "jieba"` 时才动态导入。
- 不把原生二进制复制进核心包或默认 preset。

### 6.2 初始化

```ts
import { Jieba } from "@node-rs/jieba";
import { dict } from "@node-rs/jieba/dict.js";

export async function createJiebaTokenizer(
  customDictionary: string[] = []
): Promise<Tokenizer> {
  const jieba = Jieba.withDict(dict);

  if (customDictionary.length > 0) {
    jieba.loadDict(
      Buffer.from(customDictionary.join("\n"), "utf8")
    );
  }

  return new JiebaTokenizer(jieba);
}
```

要求：

- 模块只使用动态 `import()`；静态导入会让默认安装对原生包产生硬依赖。
- ESM 里 `@node-rs/jieba/dict` 不可解析，必须写 `@node-rs/jieba/dict.js`，或封装在适配器里。
- 默认词典初始化一次，按 locale 和词表版本缓存实例。
- 词表格式由适配器校验；非法行要带文件和行号报错。
- 原生绑定加载失败时默认 fatal，错误码和平台信息明确。只有配置显式 `fallback: "intl"` 才允许降级，并在结果中标记实际 tokenizer。

### 6.3 输出映射

`@node-rs/jieba` 的 `cut()` 和 `tag()` 没有 span。适配器必须：

1. 获得 lossless token 序列。若某 token 被省略，不能猜测位置。
2. 从 `cursor = 0` 开始，要求 `input.startsWith(word, cursor)`。
3. 产出 `[cursor, cursor + word.length)`。
4. 最后断言 `cursor === input.length`。
5. 不满足时抛出适配器错误，不能返回部分诊断。

示例：

```ts
function toTokens(words: string[], input: string): Token[] {
  let cursor = 0;
  return words.map((word) => {
    if (!input.startsWith(word, cursor)) {
      throw new Error(`Tokenizer output does not cover input at ${cursor}`);
    }
    const start = cursor;
    cursor += word.length;
    return {
      text: word,
      start,
      end: cursor,
      kind: classifyWord(word),
      source: "node-rs-jieba"
    };
  });
}
```

### 6.4 POS 和规则

- `tag()` 的 `tag` 直接映射到 `Token.pos`，同时把 `posScheme` 固定为 `jieba`。
- 规则不得假设 `n`、`v`、`nz` 在所有词典中永远稳定。词性只用于缩小候选。
- `action-nominalization` 需要“空动词 + 动作名词”模式。jieba POS 能提高精度，但最终报告仍是 `heuristic`。
- `passive-voice` 需要区分 `被`、`被子`、`植被` 等。POS 和词典能降低误报，但不能把中文被动一律判错。
- `terminology` 仍先走精确术语索引，再参考 token，不能把近义分词结果直接判为同义。
- `cutAsync` 只适合未来异步 lint 或 worker。当前同步规则接口不要为它改成全异步；大文件可批量 worker。

## 7. 备选适配器

### 7.1 `jieba-wasm`

适合：

- 禁止 native addon 的 Node 环境。
- 浏览器、Deno 或未来 LSP/Web Worker。
- 需要 jieba 质量但不想依赖平台二进制。

适配要求：

- tokenize 结果的 code point 偏移必须转换成 UTF-16。
- `with_dict`、`add_word` 是全局状态，使用独立 worker 或单例初始化。
- WASM 加载失败要延迟到首次初始化，不拖慢只使用默认 tokenizer 的普通命令。
- 默认不把完整四目标产物加入 CLI 安装包。

### 7.2 `nodejieba`

仅保留兼容层，不作为新功能默认：

- 适配器要隔离进程全局词典。
- 安装失败、代理失败、native binding 缺失必须给出可操作错误。
- 不依赖其未声明全局变量行为。
- 若必须支持 `cutAll`、`cutSmall`、`textRankExtract`，单独定义扩展 capability，不能污染通用 `Tokenizer` 接口。

### 7.3 `segmentit`

不推荐新增适配器。若已有使用方，只在兼容包中做默认导入或 CJS 包装，并补齐 TypeScript 声明和 span 重建测试。不要在 stcn100 默认分发中引入其内联词典。

## 8. 与 stcn100 规则的映射

| 规则或规则族 | 是否依赖 tokenizer | 需要的分析能力 | 默认策略 |
| --- | --- | --- | --- |
| 固定错词、大小写、机器标识符 | 否 | 精确字符匹配、边界、保护区 | 独立确定性扫描 |
| 标点、留白、数字、单位 | 否 | Unicode 类别、结构、数值解析 | 独立规则，不用分词 |
| Markdown 硬换行、标题、列表 | 否 | AST 或 block scanner | 结构规则 |
| 术语一致性和别名 | 低 | 词表、全半角、大小写、首次出现 | 精确词表优先，tokenizer 只做上下文 |
| 黑话、业务热词、称呼 | 低 | 词表、上下文窗口 | 精确词表 + 语境豁免 |
| 被动候选 | 中 | 标记词、POS、上下文 | Intl 可做候选；jieba 提高精度；始终 warning/info |
| 动作名词和空动词 | 中高 | 动词、动作名词、搭配、窗口 | 固定搭配优先；jieba POS 可选 |
| 长名词簇 | 高 | 词边界、POS、术语融合 | jieba 质量足够时启用，否则跳过或 info |
| 指代候选 | 中 | 词边界、句窗、上下文 | 只能报候选，不能声称指代错误 |
| 跨文件术语和缩写 | 否或低 | 项目索引、术语表、引用图 | 跨文件索引，不用单个文档分词解决 |
| 句长和分句数 | 否 | 句子边界和计数 | 独立计数，避免 tokenizer 版本改变结果 |

规则接入原则：

- Rule metadata 增加 `requiresTokenizer?: boolean` 或 capability 声明。
- 需要 POS 的规则不能静默降级为错误；应跳过、降级为提示或按配置报 fatal。
- 规则输出必须保留 `confidence`：字符/词表确定为 `deterministic`，分词启发式为 `heuristic`，语义判断为 `semantic`。
- 同一规则不能在默认 tokenizer 与 jieba 下调成不同严重级别而不记录证据。
- 所有规则测试都要有 Intl 基线；jieba 适配器另有 contract 测试和输出快照。

## 9. 实施顺序

### P0：接口和默认基线

- 固化 `Token`、`Tokenizer`、capability 和 UTF-16 span 契约。
- 实现稳定的 `IntlWordTokenizer`，复用 segmenter，分类空格、标点和符号。
- 实现项目词表覆盖层，先做最长匹配和全量覆盖校验。
- 增加 emoji、CRLF、组合字符、CJK、Latin、数字、URL 掩码的 span 测试。
- 默认 lint 不安装或加载任何原生模块。
- 默认 tokenizer 失败时返回 fatal，不静默返回逐字 token。

### P1：规则接入

- 保持固定错词、标点、数字、单位、结构规则独立。
- 只给被动、动作名词、术语上下文和指代候选接入 tokenizer。
- 给每条规则标注 tokenizer 依赖和 confidence。
- 建立 Intl 与 jieba 输出差异快照，防止升级静默改变规则行为。

### P2：可选 jieba

- 新增 `@stcn100/tokenizer-jieba`，动态导入 `@node-rs/jieba`。
- 添加自定义词表格式、加载错误和原生绑定缺失测试。
- 缓存 Jieba 实例，按词典版本和 locale 失效。
- 处理 ESM `/dict.js` 子路径和 Windows、Linux、macOS 预编译包。
- 支持显式 `fallback: "intl"`，报告中写入实际 tokenizer。

### P3：便携和高级分析

- 增加 `jieba-wasm` 适配器，转换 code point 偏移并隔离全局词典。
- 评估异步 worker，处理大仓库和 `cutAsync`。
- 后续再评估依存句法、名词簇、指代和段落主题；不要先做复杂 NLP 管线。

## 10. 验收标准

- Node.js 22 默认安装不出现新增 native 包。
- `pnpm install --frozen-lockfile` 在 Windows 和 Linux CI 通过。
- 默认 tokenizer 对空串、CRLF、emoji、代理对、组合字符、全角/半角输入保持无损覆盖。
- 每个 token 满足 `text.slice(start, end) === token.text`。
- 所有规则诊断使用原文 span，不因掩码或 token 下标偏移。
- jieba 缺失、词表错误、WASM 初始化失败和 native binding 缺失都有确定错误路径。
- `jieba-wasm` 的 code point span 有专门转换测试，不能直接进入诊断。
- 默认和 jieba 模式对相同规则都有正例、反例、保护区和快照测试。
- 性能测试覆盖每文件初始化、每文档分词、长文本和内存；不能在每次 rule check 中重建词典。

## 11. 推荐决策摘要

| 场景 | 推荐 |
| --- | --- |
| stcn100 默认 | `Intl.Segmenter` + 项目词表覆盖层 |
| Node 生产环境需要更高准确率和 POS | `@node-rs/jieba` 可选包 |
| 禁止 native、浏览器或 Deno | `jieba-wasm` 可选包 |
| 已有 cppjieba 兼容要求 | `nodejieba` 兼容层，不默认 |
| 新项目通用方案 | 不采用 `segmentit` |
| 规则基线 | 字符/词表/AST 优先，分词只做增强 |

最终建议：核心保持零原生依赖，接口先稳定；把 `@node-rs/jieba` 做成显式可选适配器。这样既能提供完全程序化的高召回候选，又不会让 CLI 安装、Windows 开发和 CI 被某个分词库锁死。

## 12. 调研来源

- Node 22 本机：Node.js `22.17.0`，ICU `77.1`，CLDR `47.0`。
- MDN `Intl.Segmenter`：https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter
- `@node-rs/jieba` README：https://github.com/napi-rs/node-rs/tree/main/packages/jieba
- `nodejieba` README：https://github.com/yanyiwu/nodejieba
- `segmentit` README：https://github.com/linonetwo/segmentit
- `jieba-wasm` README：https://github.com/fengkx/jieba-wasm
- npm registry 元数据：`@node-rs/jieba@2.0.3`、`segmentit@2.0.3`、`jieba-wasm@2.4.0`、`nodejieba@3.5.8`
- 实测环境：Windows x64、Node.js 22.17.0、临时目录安装，未修改 stcn100 源码。
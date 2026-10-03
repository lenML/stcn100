# @lenml/stcn100

Simplified Technical Chinese 命令行检查工具。

要求 Node.js 22 或更高版本。

## 使用

无需预先安装：

```bash
npx @lenml/stcn100@latest --help
npx @lenml/stcn100@latest "docs/**/*.md" --profile general,coding
npx @lenml/stcn100@latest "docs/**/*.md" --rule typo
npx @lenml/stcn100@latest "docs/**/*.md" --fix
```

初始化配置：

```bash
npx @lenml/stcn100@latest init
```

查看内置规则：

```bash
npx @lenml/stcn100@latest rules
```

完整配置与规则说明见仓库根目录 `README.md` 和 `docs/spec/`。

## 本地开发

```bash
pnpm install
pnpm --filter @lenml/stcn100 build
node packages/cli/dist/index.js --help
```

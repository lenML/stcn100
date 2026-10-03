# CLI 发布

发布包为 `@lenml/stcn100`。用户只需安装或运行 CLI，不单独发布 `@stcn100/core` 和 `@stcn100/rules`。

## 发布模型

- `packages/core` 和 `packages/rules` 是 `private` 工作区包。
- `packages/cli` 构建时先运行 TypeScript，再用 esbuild 将 core、rules 和 `fast-glob` 内联到 `dist/index.js`。
- CLI 发布 manifest 不声明 runtime dependencies。
- `prepack` 会自动运行 build，避免发布旧 bundle。

## 前置条件

- Node.js 22 或更高版本。
- pnpm 10。
- npmjs.com 账号具有 `@lenml` scope 的发布权限。

先登录 npmjs：

```bash
pnpm npm:login
```

该脚本仅对登录命令指定 `https://registry.npmjs.org/`，不会修改本地 npm 镜像配置。

## 发布

发布前更新 `packages/cli/package.json` 的版本，运行仓库检查，再发布：

```bash
pnpm check
pnpm --filter @lenml/stcn100 publish --access public
```

`pnpm publish` 会触发 `prepack -> build`。仓库只发布 `@lenml/stcn100`；不要执行 core 或 rules 包的发布命令。

## 验证

检查发布包版本：

```bash
npm view @lenml/stcn100 version
```

检查公开 CLI：

```bash
npx @lenml/stcn100@latest --help
```

本地检查 tarball：

```bash
pnpm --filter @lenml/stcn100 pack --pack-destination <临时目录>
```

tarball 应包含 `dist/index.js`、`dist/index.d.ts`、`README.md` 和 `LICENSE`；包内 `dependencies` 应为空，`dist/index.js` 应保留 shebang。

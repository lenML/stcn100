import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const cliDirectory = path.join(repositoryRoot, "packages", "cli");
const outputFile = path.join(cliDirectory, "dist", "index.js");

await build({
  absWorkingDir: repositoryRoot,
  entryPoints: [path.join(cliDirectory, "src", "index.ts")],
  outfile: outputFile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  banner: {
    js: 'import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);'
  },
  legalComments: "none",
  logLevel: "info"
});

const output = await readFile(outputFile, "utf8");
if (!output.startsWith("#!")) {
  await writeFile(outputFile, `#!/usr/bin/env node\n${output}`, "utf8");
}
await chmod(outputFile, 0o755);

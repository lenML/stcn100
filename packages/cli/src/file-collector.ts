import { stat } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";

const DEFAULT_PATTERNS = ["**/*.{md,markdown,mdx,txt}"];
const DEFAULT_IGNORES = ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/coverage/**"];

async function expandDirectory(pattern: string, cwd: string): Promise<string> {
  const absolutePath = path.resolve(cwd, pattern);
  try {
    const info = await stat(absolutePath);
    if (info.isDirectory()) {
      return path.posix.join(pattern.replaceAll("\\", "/"), "**/*.{md,markdown,mdx,txt}");
    }
  } catch {
    return pattern;
  }
  return pattern;
}

export async function collectFiles(
  patterns: string[],
  cwd: string,
  ignore: string[]
): Promise<string[]> {
  const requested = (patterns.length > 0 ? patterns : DEFAULT_PATTERNS).map((pattern) =>
    pattern.replaceAll("\\", "/")
  );
  const expanded = await Promise.all(requested.map((pattern) => expandDirectory(pattern, cwd)));
  const matches = await fg(expanded, {
    cwd,
    absolute: true,
    dot: false,
    onlyFiles: true,
    unique: true,
    ignore: [...DEFAULT_IGNORES, ...ignore.map((pattern) => pattern.replaceAll("\\", "/"))]
  });
  return matches.map((filePath) => path.normalize(filePath)).sort();
}

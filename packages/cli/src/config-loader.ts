import { readFile } from "node:fs/promises";
import path from "node:path";
import type { StcnConfig } from "@stcn100/core";

export interface LoadedConfig {
  config: StcnConfig;
  path?: string;
}

const CONFIG_FILES = ["stcn100.config.json", ".stcn100rc.json"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseConfig(value: unknown, filePath: string): StcnConfig {
  if (!isRecord(value)) {
    throw new Error(`Config must be a JSON object: ${filePath}`);
  }
  return value as StcnConfig;
}

async function tryReadConfig(filePath: string): Promise<StcnConfig> {
  const contents = await readFile(filePath, "utf8");
  return parseConfig(JSON.parse(contents) as unknown, filePath);
}

export async function loadConfig(cwd: string, explicitPath?: string): Promise<LoadedConfig> {
  if (explicitPath) {
    const filePath = path.resolve(cwd, explicitPath);
    return { config: await tryReadConfig(filePath), path: filePath };
  }

  for (const name of CONFIG_FILES) {
    const filePath = path.join(cwd, name);
    try {
      return { config: await tryReadConfig(filePath), path: filePath };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  try {
    const packagePath = path.join(cwd, "package.json");
    const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as Record<string, unknown>;
    if (isRecord(packageJson.stcn100)) {
      return {
        config: parseConfig(packageJson.stcn100, packagePath),
        path: packagePath
      };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return { config: { extends: ["general"] } };
}

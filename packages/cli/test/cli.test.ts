import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("runCli", () => {
  it("accepts whitespace-separated profiles", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "stcn100-"));
    temporaryDirectories.push(cwd);
    await writeFile(path.join(cwd, "sample.md"), "失败！！！\n");
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const exitCode = await runCli(["lint", "sample.md", "--profile", "general coding"], cwd);

    expect(exitCode).toBe(1);
  });

  it("runs only the selected typo rule", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "stcn100-"));
    temporaryDirectories.push(cwd);
    await writeFile(path.join(cwd, "sample.md"), "阀值！！！\n");
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const exitCode = await runCli(["lint", "sample.md", "--format", "json", "-r", "typo"], cwd);

    expect(exitCode).toBe(1);
    const output = write.mock.calls.map(([chunk]) => String(chunk)).join("");
    const result = JSON.parse(output) as {
      reports: Array<{ diagnostics: Array<{ ruleId: string }> }>;
    };
    const ruleIds = result.reports.flatMap((report) =>
      report.diagnostics.map((diagnostic) => diagnostic.ruleId)
    );
    expect(ruleIds).toEqual(["typo"]);
  });

  it("supports repeated, comma-separated, and duplicate rule selections", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "stcn100-"));
    temporaryDirectories.push(cwd);
    await writeFile(path.join(cwd, "sample.md"), "阀值！！！\n");
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const exitCode = await runCli(
      ["lint", "sample.md", "--format", "json", "-r", "typo,typo", "-r", "repeated-punctuation"],
      cwd
    );

    expect(exitCode).toBe(1);
    const output = write.mock.calls.map(([chunk]) => String(chunk)).join("");
    const result = JSON.parse(output) as {
      reports: Array<{ diagnostics: Array<{ ruleId: string }> }>;
    };
    const ruleIds = result.reports
      .flatMap((report) => report.diagnostics.map((diagnostic) => diagnostic.ruleId))
      .sort();
    expect(ruleIds).toEqual(["repeated-punctuation", "typo"]);
  });

  it("fails for an unknown selected rule", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "stcn100-"));
    temporaryDirectories.push(cwd);
    await writeFile(path.join(cwd, "sample.md"), "阀值\n");
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const exitCode = await runCli(["lint", "sample.md", "-r", "unknown-rule"], cwd);

    expect(exitCode).toBe(2);
    expect(stderr).toHaveBeenCalledWith("Unknown rule: unknown-rule\n");
  });

  it("fails for a disabled selected rule", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "stcn100-"));
    temporaryDirectories.push(cwd);
    await writeFile(
      path.join(cwd, "stcn100.config.json"),
      JSON.stringify({ extends: ["general"], rules: { typo: "off" } })
    );
    await writeFile(path.join(cwd, "sample.md"), "阀值\n");
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const exitCode = await runCli(["lint", "sample.md", "-r", "typo"], cwd);

    expect(exitCode).toBe(2);
    expect(stderr).toHaveBeenCalledWith("Rule is disabled: typo\n");
  });

  it("loads config and fixes files with --fix", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "stcn100-"));
    temporaryDirectories.push(cwd);
    await writeFile(
      path.join(cwd, "stcn100.config.json"),
      JSON.stringify({
        extends: ["general"],
        rules: {
          terminology: ["warning", { terms: [{ preferred: "配置", aliases: ["设定"] }] }]
        }
      })
    );
    await writeFile(path.join(cwd, "sample.md"), "设定服务。\n");
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const exitCode = await runCli(["lint", "sample.md", "--fix"], cwd);
    expect(exitCode).toBe(0);
    expect(await readFile(path.join(cwd, "sample.md"), "utf8")).toBe("配置服务。\n");
  });

  it("rejects invalid max warnings before writing fixes", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "stcn100-"));
    temporaryDirectories.push(cwd);
    const filePath = path.join(cwd, "sample.md");
    await writeFile(filePath, "失败！！！\n");
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const exitCode = await runCli(
      ["lint", "sample.md", "--profile", "general", "--fix", "--max-warnings", "invalid"],
      cwd
    );

    expect(exitCode).toBe(2);
    expect(await readFile(filePath, "utf8")).toBe("失败！！！\n");
  });

  it("prints the package version", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8")
    ) as { version: string };

    const exitCode = await runCli(["--version"]);

    expect(exitCode).toBe(0);
    expect(write).toHaveBeenCalledWith(`${packageJson.version}\n`);
  });
});

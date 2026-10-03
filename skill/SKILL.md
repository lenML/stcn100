---
name: stcn100-docs-lint
description: Run and apply @lenml/stcn100 programmatic checks for Simplified Technical Chinese. Use when Codex needs to inspect, edit, review, validate, or CI-enforce Chinese technical documentation with stcn100, including selecting rules or profiles, applying safe fixes, reviewing heuristic findings, configuring terminology, or resolving formatter conflicts.
---

# STCN100 Technical Chinese Lint

Use the CLI as the source of truth for every diagnostic. Do not invent style violations or present prose review as stcn100 output.

## Choose the command

Prefer the executable already present in the workspace:

1. Repository development: `pnpm stcn100`
2. Installed package: `pnpm exec stcn100`
3. No local installation: `npx --yes @lenml/stcn100@latest`

If the repository CLI is missing, run `pnpm build` first.

## Lint workflow

1. Read metadata before choosing rules:

```bash
stcn100 --help
stcn100 rules
```

2. Quote file arguments and globs for the active shell. If no files are supplied, stcn100 scans `**/*.{md,markdown,mdx,txt}`.

3. Start with machine-readable output:

```bash
stcn100 "docs/**/*.md" --profile coding --format json
```

Use `--profile coding` for programming documentation because it includes `general`. Omit `--profile` to use discovered configuration. Pass `--profile general` only for general prose.

4. Process diagnostics by `ruleId`, `severity`, `confidence`, and `loc`. Preserve the reported values in summaries.

5. Apply only safe automatic fixes:

```bash
stcn100 "docs/**/*.md" --profile coding --fix
```

6. Re-run the same JSON command after fixes. Never report success from the pre-fix result.

7. Review remaining diagnostics manually. For `heuristic` results, inspect surrounding context and protect intentional examples. For `semantic` results, require a factual source or explicit project decision.

8. Inspect the final diff. Report unresolved diagnostics separately from fixes.

## Select rules and profiles

Run one rule or a small set when isolating behavior:

```bash
stcn100 "docs/**/*.md" --rule typo
stcn100 "docs/**/*.md" --rule "typo,repeated-punctuation"
stcn100 "docs/**/*.md" -r typo -r sentence-length
```

`--rule` only runs the selected rules. Unknown rules and disabled rules exit with code `2`. `--profile` replaces the configuration's `extends`; it does not merge with existing profiles.

Use these confidence meanings:

- `deterministic`: reproducible after parsing and configuration. Apply `fix` when present.
- `heuristic`: the location is reproducible, but context determines whether the text is wrong. Review before editing.
- `semantic`: requires facts, schema, or complete meaning. Do not infer a violation from the candidate alone.

## Configure the project

Use `stcn100 init` to create `stcn100.config.json`. Discovery order is:

1. `--config <path>`
2. `stcn100.config.json`
3. `.stcn100rc.json`
4. `package.json` field `stcn100`
5. Built-in `general` profile

Example:

```json
{
  "extends": ["coding"],
  "ignore": ["vendor/**"],
  "rules": {
    "sentence-length": ["warning", { "suggestedMax": 30, "hardMax": 40 }],
    "terminology": [
      "warning",
      {
        "terms": [
          {
            "preferred": "配置",
            "aliases": ["设定"]
          }
        ]
      }
    ],
    "paragraph-hard-wrap": "off"
  }
}
```

Severity values are `off`, `info`, `warning`, and `error`. Prefer project terminology and rule options over adding disabling comments.

## Handle exceptions

Use an inline directive only after confirming a false positive:

```markdown
保留原文 <!-- stcn100-disable-line -->
```

Use a file-level exception only when the whole file is outside the rule's scope:

```markdown
<!-- stcn100-disable-file -->
```

The legacy `copy-lint-disable-line` and `copy-lint-disable-file` forms are also accepted. Code blocks and HTML blocks do not activate directives.

## Check formatter compatibility

- Prettier default `proseWrap: preserve` is compatible.
- Prettier `proseWrap: always` conflicts with `paragraph-hard-wrap`. Turn off one of them.
- markdownlint default `MD013` conflicts with `paragraph-hard-wrap`. Disable or relax `MD013`, or disable `paragraph-hard-wrap`.
- Run markdownlint fixes and Prettier before the final stcn100 pass.

Do not run a formatter after the final stcn100 pass if that formatter can reintroduce hard wraps.

## CI and exit codes

```bash
stcn100 "docs/**/*.md" --profile coding --max-warnings 0
```

- `0`: no error and warnings remain within the configured threshold.
- `1`: at least one error, or warnings exceed `--max-warnings`.
- `2`: invalid arguments, configuration, files, or runtime failure.

Do not treat exit code `1` as a tool failure. Parse its diagnostics and fix or report them.

## Report results

Lead with programmatic findings. Include:

- Executed command and scope.
- Diagnostics by file, line, column, severity, confidence, and rule ID.
- Safe fixes applied.
- Remaining heuristic or semantic findings requiring judgment.
- Final rerun result and exit code.

Never write "all violations fixed" while unresolved diagnostics or a non-zero exit code remain.

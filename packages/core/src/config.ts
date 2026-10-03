import type {
  Plugin,
  Preset,
  ResolvedConfig,
  ResolvedRuleSetting,
  RuleModule,
  RuleRegistry,
  RuleSettingInput,
  StcnConfig
} from "./types.js";

export function defineRule<TOptions>(rule: RuleModule<TOptions>): RuleModule<TOptions> {
  return rule;
}

export function definePlugin(plugin: Plugin): Plugin {
  return plugin;
}

export function defineConfig(config: StcnConfig): StcnConfig {
  return config;
}

export function createRegistry(plugins: Plugin[] = []): RuleRegistry {
  const registry: RuleRegistry = {
    rules: new Map<string, RuleModule<any>>(),
    presets: new Map<string, Preset>()
  };

  for (const plugin of plugins) {
    for (const rule of plugin.rules ?? []) {
      if (registry.rules.has(rule.meta.id)) {
        throw new Error(`Rule already registered: ${rule.meta.id}`);
      }
      registry.rules.set(rule.meta.id, rule);
    }

    for (const [name, preset] of Object.entries(plugin.presets ?? {})) {
      if (registry.presets.has(name)) {
        throw new Error(`Preset already registered: ${name}`);
      }
      registry.presets.set(name, preset);
    }
  }

  return registry;
}

const SEVERITIES = new Set(["off", "info", "warning", "error"]);

function assertSeverity(value: unknown): asserts value is ResolvedRuleSetting["severity"] {
  if (typeof value !== "string" || !SEVERITIES.has(value)) {
    throw new Error(`Invalid severity: ${String(value)}`);
  }
}

function assertKnownRule(ruleId: string, registry: RuleRegistry): void {
  if (!registry.rules.has(ruleId)) {
    throw new Error(`Unknown rule: ${ruleId}`);
  }
}

function applyRuleSetting(
  ruleId: string,
  setting: RuleSettingInput | undefined,
  rules: Record<string, ResolvedRuleSetting>,
  registry: RuleRegistry
): void {
  assertKnownRule(ruleId, registry);
  const previous = rules[ruleId];

  if (setting === undefined || setting === "off") {
    delete rules[ruleId];
    return;
  }

  if (typeof setting === "string") {
    assertSeverity(setting);
    rules[ruleId] = previous ? { ...previous, severity: setting } : { severity: setting };
    return;
  }

  if (!Array.isArray(setting) || setting.length < 1 || setting.length > 2) {
    throw new Error(`Invalid rule setting for ${ruleId}`);
  }

  const severity = setting[0];
  assertSeverity(severity);
  rules[ruleId] = setting.length === 2
    ? { severity, options: setting[1] }
    : previous
      ? { ...previous, severity }
      : { severity };
}

function normalizeExtends(value: StcnConfig["extends"]): string[] {
  if (value === undefined) {
    return [];
  }
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  throw new Error("Config extends must be a string or string array");
}

function normalizeIgnore(value: StcnConfig["ignore"]): string[] {
  if (value === undefined) {
    return [];
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  throw new Error("Config ignore must be a string array");
}

function collectPreset(
  name: string,
  registry: RuleRegistry,
  rules: Record<string, ResolvedRuleSetting>,
  ignore: Set<string>,
  stack: string[]
): void {
  if (stack.includes(name)) {
    throw new Error(`Preset cycle detected: ${[...stack, name].join(" -> ")}`);
  }

  const preset = registry.presets.get(name);
  if (!preset) {
    throw new Error(`Unknown preset: ${name}`);
  }

  for (const parent of preset.extends ?? []) {
    collectPreset(parent, registry, rules, ignore, [...stack, name]);
  }

  for (const [ruleId, setting] of Object.entries(preset.rules)) {
    applyRuleSetting(ruleId, setting, rules, registry);
  }

  for (const pattern of preset.ignore ?? []) {
    ignore.add(pattern);
  }
}

export function resolveConfig(config: StcnConfig, registry: RuleRegistry): ResolvedConfig {
  const rules: Record<string, ResolvedRuleSetting> = {};
  const ignore = new Set<string>();
  const extended = normalizeExtends(config.extends);

  for (const preset of extended) {
    collectPreset(preset, registry, rules, ignore, []);
  }

  for (const [ruleId, setting] of Object.entries(config.rules ?? {})) {
    applyRuleSetting(ruleId, setting, rules, registry);
  }

  for (const pattern of normalizeIgnore(config.ignore)) {
    ignore.add(pattern);
  }

  return {
    rules,
    ignore: [...ignore]
  };
}

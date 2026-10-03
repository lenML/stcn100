export interface ReplacementEntry {
  pattern: RegExp;
  replacement: string | ((match: RegExpMatchArray) => string);
  message?: string;
}

export interface ReplacementMatch {
  value: string;
  replacement: string;
  start: number;
  end: number;
  message?: string;
}

export function findReplacementMatches(
  text: string,
  entries: ReplacementEntry[]
): ReplacementMatch[] {
  const candidates: Array<ReplacementMatch & { valueLength: number }> = [];

  for (const entry of entries) {
    const flags = entry.pattern.flags.includes("g") ? entry.pattern.flags : `${entry.pattern.flags}g`;
    const expression = new RegExp(entry.pattern.source, flags);
    for (const match of text.matchAll(expression)) {
      if (match.index === undefined || match[0].length === 0) {
        continue;
      }
      const replacement =
        typeof entry.replacement === "function"
          ? entry.replacement(match)
          : entry.replacement;
      if (replacement === match[0]) {
        continue;
      }
      candidates.push({
        value: match[0],
        replacement,
        start: match.index,
        end: match.index + match[0].length,
        valueLength: match[0].length,
        ...(entry.message ? { message: entry.message } : {})
      });
    }
  }

  candidates.sort((left, right) => left.start - right.start || right.valueLength - left.valueLength);
  const accepted: ReplacementMatch[] = [];
  let previousEnd = -1;

  for (const candidate of candidates) {
    if (candidate.start < previousEnd) {
      continue;
    }
    accepted.push({
      value: candidate.value,
      replacement: candidate.replacement,
      start: candidate.start,
      end: candidate.end,
      ...(candidate.message ? { message: candidate.message } : {})
    });
    previousEnd = candidate.end;
  }

  return accepted;
}

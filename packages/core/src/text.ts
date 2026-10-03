import type { Location, Position } from "./types.js";

export function getLineStarts(source: string): number[] {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") {
      starts.push(index + 1);
    }
  }
  return starts;
}

export function positionAt(source: string, offset: number, lineStarts = getLineStarts(source)): Position {
  const boundedOffset = Math.max(0, Math.min(offset, source.length));
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const start = lineStarts[middle] ?? 0;
    if (start <= boundedOffset) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  const lineIndex = Math.max(0, high);
  const lineStart = lineStarts[lineIndex] ?? 0;
  return {
    line: lineIndex + 1,
    column: boundedOffset - lineStart + 1,
    offset: boundedOffset
  };
}

export function locationAt(
  source: string,
  start: number,
  end: number,
  lineStarts = getLineStarts(source)
): Location {
  return {
    start: positionAt(source, start, lineStarts),
    end: positionAt(source, end, lineStarts)
  };
}

export function countReadableUnits(text: string): number {
  const cjkCount = Array.from(text).filter((character) => /\p{Script=Han}/u.test(character)).length;
  const latinWords = text.match(/[A-Za-z0-9]+(?:[._:/-][A-Za-z0-9]+)*/g)?.length ?? 0;
  return cjkCount + latinWords;
}

export interface RegexMatch {
  value: string;
  start: number;
  end: number;
}

export function findMatches(text: string, pattern: RegExp): RegexMatch[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const expression = new RegExp(pattern.source, flags);
  const matches: RegexMatch[] = [];

  for (const match of text.matchAll(expression)) {
    if (match.index === undefined || match[0].length === 0) {
      continue;
    }
    matches.push({
      value: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }
  return matches;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findTermMatches(text: string, terms: string[]): RegexMatch[] {
  const candidates: Array<RegexMatch & { termLength: number }> = [];

  for (const term of terms) {
    for (const match of findMatches(text, new RegExp(escapeRegExp(term), "gu"))) {
      candidates.push({ ...match, termLength: term.length });
    }
  }

  candidates.sort((left, right) => left.start - right.start || right.termLength - left.termLength);
  const accepted: RegexMatch[] = [];
  let previousEnd = -1;

  for (const candidate of candidates) {
    if (candidate.start < previousEnd) {
      continue;
    }
    accepted.push({
      value: candidate.value,
      start: candidate.start,
      end: candidate.end
    });
    previousEnd = candidate.end;
  }

  return accepted;
}
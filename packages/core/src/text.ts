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

const WIDE_CHARACTER = /[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/u;
const WIDE_PUNCTUATION = /[\u3001\u3002\uff01\uff08\uff09\uff0c\uff1a\uff1b\uff1f\u2014\u2026\u300a-\u3011\u300c\u300d]/u;
const ASCII_TRAILING_NO_SPACE = new Set(["(", "[", "{", "<", "-", "/", "@", "#", "$", "&", "+", "=", "\\", "\"", "'"]);
const ASCII_LEADING_NO_SPACE = new Set([",", ".", ";", ":", "!", "?", ")", "]", "}", ">", "%", "\"", "'"]);

function visibleTail(value: string): string {
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const character = value[index] ?? "";
    if (!"*_~`".includes(character)) {
      return character;
    }
  }
  return "";
}

function visibleHead(value: string): string {
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? "";
    if (!"*_~`[".includes(character)) {
      return character;
    }
  }
  return "";
}

export function joinChineseLines(left: string, right: string): string {
  const tail = visibleTail(left);
  const head = visibleHead(right);
  if (!tail || !head) {
    return "";
  }
  if (WIDE_CHARACTER.test(tail) || WIDE_CHARACTER.test(head)) {
    if (WIDE_CHARACTER.test(tail) && WIDE_CHARACTER.test(head)) {
      return "";
    }
    if (WIDE_PUNCTUATION.test(tail) || WIDE_PUNCTUATION.test(head)) {
      return "";
    }
    return " ";
  }
  if (ASCII_TRAILING_NO_SPACE.has(tail) || ASCII_LEADING_NO_SPACE.has(head)) {
    return "";
  }
  return " ";
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

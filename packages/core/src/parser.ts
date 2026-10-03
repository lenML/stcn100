import { getLineStarts, locationAt } from "./text.js";
import type { BlockKind, Document, TextBlock } from "./types.js";


function maskRange(characters: string[], start: number, end: number): void {
  for (let index = start; index < end; index += 1) {
    if (characters[index] !== "\n") {
      characters[index] = " ";
    }
  }
}

function maskWithPattern(text: string, pattern: RegExp, preserveFirstCapture = false): string {
  const characters = text.split("");
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const expression = new RegExp(pattern.source, flags);

  for (const match of text.matchAll(expression)) {
    if (match.index === undefined) {
      continue;
    }
    const start = match.index;
    const end = start + match[0].length;
    maskRange(characters, start, end);
    if (preserveFirstCapture && match[1] !== undefined) {
      const relativeStart = match[0].indexOf(match[1]);
      const captureStart = start + relativeStart;
      for (let index = 0; index < match[1].length; index += 1) {
        characters[captureStart + index] = match[1][index] ?? " ";
      }
    }
  }

  return characters.join("");
}

function maskMarkdownInline(text: string): string {
  let output = text;
  output = maskWithPattern(output, /`[^`\n]*`/g);
  output = maskWithPattern(output, /<!--[\s\S]*?-->/g);
  output = maskWithPattern(output, /<\/?[A-Za-z][^>\n]*>/g);
  output = maskWithPattern(output, /!\[[^\]\n]*\]\([^)\n]*\)/g);
  output = maskWithPattern(output, /\[([^\]\n]+)\]\([^)\n]*\)/g, true);
  output = maskWithPattern(output, /<https?:\/\/[^>\s]+>/g);
  output = maskWithPattern(output, /https?:\/\/[^\s<>()]+/g);
  return output;
}

function hasClosedFrontmatter(source: string): boolean {
  const opening = source.match(/^---\r?\n/);
  if (!opening) {
    return false;
  }
  return /\r?\n---(?:\r?\n|$)/.test(source.slice(opening[0].length));
}

function isIndentedCodeLine(line: string): boolean {
  return /^(?: {4}|\t)/.test(line);
}

function linePrefixMatch(line: string): { start: number; kind: BlockKind } | undefined {
  const heading = line.match(/^( {0,3}#{1,6}\s+)/);
  if (heading) {
    return { start: heading[1]?.length ?? 0, kind: "heading" };
  }

  const quote = line.match(/^( {0,3}>\s?)/);
  if (quote) {
    return { start: quote[1]?.length ?? 0, kind: "blockquote" };
  }

  const list = line.match(/^( {0,6}(?:[-+*]|\d+[.)])\s+)/);
  if (list) {
    return { start: list[1]?.length ?? 0, kind: "list-item" };
  }

  if (/^\s*\|.*\|\s*$/.test(line)) {
    return { start: 0, kind: "table" };
  }

  return { start: 0, kind: "paragraph" };
}

function parseMarkdown(source: string, filePath: string): Document {
  const lineStarts = getLineStarts(source);
  const blocks: TextBlock[] = [];
  let offset = 0;
  let inFence = false;
  let fenceMarker = "";
  let inFrontmatter = false;
  let inHtmlComment = false;
  const frontmatterEnabled = hasClosedFrontmatter(source);

  for (const lineWithEnding of source.match(/.*(?:\r?\n|$)/g) ?? []) {
    if (lineWithEnding.length === 0) {
      continue;
    }

    const line = lineWithEnding.replace(/\r?\n$/, "");
    const trimmed = line.trim();
    const fence = trimmed.match(/^(`{3,}|~{3,})(.*)$/);

    if (offset === 0 && trimmed === "---" && frontmatterEnabled) {
      inFrontmatter = true;
      offset += lineWithEnding.length;
      continue;
    }

    if (inFrontmatter) {
      if (trimmed === "---") {
        inFrontmatter = false;
      }
      offset += lineWithEnding.length;
      continue;
    }

    if (inHtmlComment) {
      if (line.includes("-->")) {
        inHtmlComment = false;
      }
      offset += lineWithEnding.length;
      continue;
    }

    const commentStart = line.indexOf("<!--");
    if (!inFence && commentStart >= 0 && !line.includes("-->", commentStart + 4)) {
      inHtmlComment = true;
      offset += lineWithEnding.length;
      continue;
    }

    if (fence) {
      const marker = fence[1] ?? "";
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (
        marker[0] === fenceMarker[0] &&
        marker.length >= fenceMarker.length &&
        (fence[2] ?? "").trim() === ""
      ) {
        inFence = false;
        fenceMarker = "";
      }
      offset += lineWithEnding.length;
      continue;
    }

    if (
      !inFence &&
      !isIndentedCodeLine(line) &&
      trimmed.length > 0 &&
      trimmed !== "---"
    ) {
      const prefix = linePrefixMatch(line);
      if (prefix) {
        const textStart = prefix.start;
        const text = line.slice(textStart);
        if (text.trim().length > 0) {
          const absoluteStart = offset + textStart;
          const analysisText = maskMarkdownInline(text);
          blocks.push({
            kind: prefix.kind,
            text,
            analysisText,
            range: [absoluteStart, absoluteStart + text.length],
            loc: locationAt(source, absoluteStart, absoluteStart + text.length, lineStarts)
          });
        }
      }
    }

    offset += lineWithEnding.length;
  }

  return { filePath, source, sourceType: "markdown", lineStarts, blocks };
}

function parsePlainText(source: string, filePath: string): Document {
  const lineStarts = getLineStarts(source);
  const blocks: TextBlock[] = [];
  let offset = 0;

  for (const lineWithEnding of source.match(/.*(?:\r?\n|$)/g) ?? []) {
    if (lineWithEnding.length === 0) {
      continue;
    }

    const line = lineWithEnding.replace(/\r?\n$/, "");
    if (line.trim().length > 0) {
      blocks.push({
        kind: "plain",
        text: line,
        analysisText: maskMarkdownInline(line),
        range: [offset, offset + line.length],
        loc: locationAt(source, offset, offset + line.length, lineStarts)
      });
    }
    offset += lineWithEnding.length;
  }

  return { filePath, source, sourceType: "text", lineStarts, blocks };
}

export function parseDocument(filePath: string, source: string): Document {
  if (/\.(?:md|markdown|mdx)$/i.test(filePath)) {
    return parseMarkdown(source, filePath);
  }
  return parsePlainText(source, filePath);
}

import { getLineStarts, locationAt } from "./text.js";
import type { BlockKind, Document, HardWrap, TextBlock } from "./types.js";


const MASK_CHARACTER = "\u0000";
const FILE_DISABLE_DIRECTIVE = /<!--\s*(?:stcn100|copy-lint)-disable-file\s*-->/u;
const LINE_DISABLE_DIRECTIVE = /<!--\s*(?:stcn100|copy-lint)-disable-line\s*-->/u;

function isDisableDirective(value: string): boolean {
  return FILE_DISABLE_DIRECTIVE.test(value) || LINE_DISABLE_DIRECTIVE.test(value);
}

function hasVisibleText(value: string): boolean {
  return value.replaceAll(MASK_CHARACTER, "").trim().length > 0;
}

function maskRange(characters: string[], start: number, end: number): void {
  for (let index = start; index < end; index += 1) {
    if (characters[index] !== "\n" && characters[index] !== "\r") {
      characters[index] = MASK_CHARACTER;
    }
  }
}

function maskWithPattern(
  text: string,
  pattern: RegExp,
  preserveFirstCapture = false,
  shouldMask: (match: RegExpExecArray) => boolean = () => true
): string {
  const characters = text.split("");
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const expression = new RegExp(pattern.source, flags);

  for (const match of text.matchAll(expression)) {
    if (match.index === undefined || !shouldMask(match)) {
      continue;
    }
    const start = match.index;
    const end = start + match[0].length;
    maskRange(characters, start, end);
    if (preserveFirstCapture && match[1] !== undefined) {
      const relativeStart = match[0].indexOf(match[1]);
      const captureStart = start + relativeStart;
      for (let index = 0; index < match[1].length; index += 1) {
        characters[captureStart + index] = match[1][index] ?? MASK_CHARACTER;
      }
    }
  }

  return characters.join("");
}

function findMarkdownLinkEnd(text: string, start: number): number | undefined {
  let depth = 1;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index] ?? "";
    if (character === "\n") {
      return undefined;
    }
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return undefined;
}

function maskMarkdownLinks(text: string): string {
  const characters = text.split("");
  for (let index = 0; index < text.length; index += 1) {
    const image = text[index] === "!" && text[index + 1] === "[";
    const labelStart = image ? index + 2 : text[index] === "[" ? index + 1 : -1;
    if (labelStart < 0) {
      continue;
    }

    const labelEnd = text.indexOf("]", labelStart);
    if (labelEnd < 0 || text[labelEnd + 1] !== "(") {
      continue;
    }
    const end = findMarkdownLinkEnd(text, labelEnd + 2);
    if (end === undefined) {
      continue;
    }

    maskRange(characters, index, end + 1);
    if (!image) {
      for (let labelIndex = labelStart; labelIndex < labelEnd; labelIndex += 1) {
        characters[labelIndex] = text[labelIndex] ?? MASK_CHARACTER;
      }
    }
    index = end;
  }
  return characters.join("");
}

function maskBareUrls(text: string): string {
  const characters = text.split("");
  const expression = /https?:\/\//gu;

  for (const match of text.matchAll(expression)) {
    if (match.index === undefined) {
      continue;
    }

    let depth = 0;
    let end = match.index + match[0].length;
    for (; end < text.length; end += 1) {
      const character = text[end] ?? "";
      if (/\s/u.test(character) || character === "<" || character === ">") {
        break;
      }
      if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        if (depth === 0) {
          break;
        }
        depth -= 1;
      }
    }
    maskRange(characters, match.index, end);
  }

  return characters.join("");
}

function maskMarkdownInline(text: string): string {
  let output = text;
  output = maskWithPattern(output, /`[^`\n]*`/g);
  output = maskWithPattern(
    output,
    /<!--[\s\S]*?-->/g,
    false,
    (match) => !isDisableDirective(match[0])
  );
  output = maskWithPattern(output, /<\/?[A-Za-z][^>\n]*>/g);
  output = maskMarkdownLinks(output);
  output = maskWithPattern(output, /<https?:\/\/[^>\s]+>/g);
  output = maskBareUrls(output);
  output = maskWithPattern(
    output,
    /(?<![A-Za-z0-9_])\/[A-Za-z0-9._~%-]+(?:\/[A-Za-z0-9._~%-]+)*(?:\?[^\s)]*)?(?![A-Za-z0-9_])/g
  );
  return output;
}

function maskInlineCodeSpans(source: string): string {
  const characters = source.split("");
  const expression = /(?<!`)(`{1,2})(?!`)[\s\S]*?(?<!`)\1(?!`)/gu;
  for (const match of source.matchAll(expression)) {
    if (match.index === undefined || /\n\s*\n/u.test(match[0])) {
      continue;
    }
    maskRange(characters, match.index, match.index + match[0].length);
  }
  return characters.join("");
}

function maskCrossLineProtected(source: string): string {
  let output = source;
  output = maskWithPattern(
    output,
    /<!--[\s\S]*?-->/g,
    false,
    (match) => !isDisableDirective(match[0])
  );
  output = maskWithPattern(output, /<(pre|script|style|textarea)(?=[\s/>])[\s\S]*?<\/\1>/gi);
  output = maskWithPattern(
    output,
    /<\/?[A-Za-z][A-Za-z0-9:-]*(?=[\s/>])(?:[^<>"']|"[^"]*"|'[^']*')*>/g
  );
  return maskInlineCodeSpans(output);
}

type ContainerState =
  | { kind: "quote" }
  | { kind: "list"; requiredIndent: number };

function containerPrefixInfo(line: string): { content: string; state?: ContainerState } {
  let content = line;
  let sawQuote = false;
  while (true) {
    const quote = content.match(/^ {0,3}>\s?/u);
    if (!quote) {
      break;
    }
    sawQuote = true;
    content = content.slice(quote[0].length);
  }

  const prefixLength = line.length - content.length;
  const list = content.match(/^( {0,6}(?:[-+*]|\d+[.)])\s+)/u);
  if (list) {
    return {
      content: content.slice(list[0].length),
      state: { kind: "list", requiredIndent: prefixLength + list[0].length }
    };
  }
  return sawQuote ? { content, state: { kind: "quote" } } : { content };
}


function lineContinuesContainer(line: string, state: ContainerState): boolean {
  if (state.kind === "quote") {
    return /^ {0,3}>/u.test(line);
  }
  const leadingSpaces = line.match(/^ */u)?.[0].length ?? 0;
  return leadingSpaces >= state.requiredIndent || /^ {0,3}(?:[-+*]|\d+[.)])\s+/u.test(line);
}

function nextNonBlankLine(lines: string[], startLineIndex: number): string | undefined {
  for (let index = startLineIndex; index < lines.length; index += 1) {
    const line = (lines[index] ?? "").replace(/\r?\n$/, "");
    if (line.trim().length > 0) {
      return line;
    }
  }
  return undefined;
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
  const hardWraps: HardWrap[] = [];
  const disabledLines: number[] = [];
  let previousCandidate: TextBlock | undefined;
  let offset = 0;
  let inFence = false;
  let fenceMarker = "";
  let fenceContainer: ContainerState | undefined;
  let inFrontmatter = false;
  let inHtmlComment = false;
  const frontmatterEnabled = hasClosedFrontmatter(source);
  const protectedSource = maskCrossLineProtected(source);
  const sourceLines = source.match(/.*(?:\r?\n|$)/g) ?? [];
  const protectedLines = protectedSource.match(/.*(?:\r?\n|$)/g) ?? [];

  for (let lineIndex = 0; lineIndex < sourceLines.length; lineIndex += 1) {
    const lineWithEnding = sourceLines[lineIndex] ?? "";
    if (lineWithEnding.length === 0) {
      continue;
    }

    const line = lineWithEnding.replace(/\r?\n$/, "");
    const analysisLine = (protectedLines[lineIndex] ?? line).replace(/\r?\n$/, "");
    let createdBlock: TextBlock | undefined;
    const trimmed = analysisLine.trim();
    const containerInfo = containerPrefixInfo(analysisLine);
    const containerContent = containerInfo.content;
    const fence = containerContent.trim().match(/^(`{3,}|~{3,})(.*)$/);

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

    if (!inFence && FILE_DISABLE_DIRECTIVE.test(analysisLine)) {
      return {
        filePath,
        source,
        sourceType: "markdown",
        lineStarts,
        blocks: [],
        hardWraps: [],
        disabledLines: [lineIndex + 1]
      };
    }

    if (!inFence && LINE_DISABLE_DIRECTIVE.test(analysisLine)) {
      disabledLines.push(lineIndex + 1);
      offset += lineWithEnding.length;
      continue;
    }

    if (inFence && fenceContainer && trimmed === "") {
      const nextLine = nextNonBlankLine(sourceLines, lineIndex + 1);
      if (!nextLine || !lineContinuesContainer(nextLine, fenceContainer)) {
        inFence = false;
        fenceMarker = "";
        fenceContainer = undefined;
      }
      offset += lineWithEnding.length;
      continue;
    }

    if (fence) {
      const marker = fence[1] ?? "";
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
        fenceContainer = containerInfo.state;
      } else if (
        marker[0] === fenceMarker[0] &&
        marker.length >= fenceMarker.length &&
        (fence[2] ?? "").trim() === ""
      ) {
        inFence = false;
        fenceMarker = "";
        fenceContainer = undefined;
      }
      offset += lineWithEnding.length;
      continue;
    }

    if (
      !inFence &&
      !isIndentedCodeLine(line) &&
      hasVisibleText(analysisLine) &&
      trimmed !== "---"
    ) {
      const prefix = linePrefixMatch(line);
      if (prefix) {
        const textStart = prefix.start;
        const text = line.slice(textStart);
        if (text.trim().length > 0) {
          const absoluteStart = offset + textStart;
          const analysisText = maskMarkdownInline(analysisLine.slice(textStart));
          const block: TextBlock = {
            kind: prefix.kind,
            text,
            analysisText,
            range: [absoluteStart, absoluteStart + text.length],
            loc: locationAt(source, absoluteStart, absoluteStart + text.length, lineStarts)
          };
          blocks.push(block);
          createdBlock = block;
        }
      }
    }

    if (createdBlock) {
      const previousKind = previousCandidate?.kind;
      const currentKind = createdBlock.kind;
      const wrappable =
        (previousKind === "paragraph" && currentKind === "paragraph") ||
        (previousKind === "list-item" && currentKind === "paragraph");
      if (
        previousCandidate &&
        wrappable &&
        !/(?: {2,}|\\)$/u.test(previousCandidate.text) &&
        createdBlock.loc.start.line === previousCandidate.loc.end.line + 1
      ) {
        hardWraps.push({
          range: [previousCandidate.range[1], createdBlock.range[0]],
          startLine: previousCandidate.loc.end.line,
          endLine: createdBlock.loc.start.line
        });
      }
      previousCandidate = createdBlock;
    } else {
      previousCandidate = undefined;
    }

    offset += lineWithEnding.length;
  }

  return { filePath, source, sourceType: "markdown", lineStarts, blocks, hardWraps, disabledLines };
}

function parsePlainText(source: string, filePath: string): Document {
  const lineStarts = getLineStarts(source);
  const blocks: TextBlock[] = [];
  const disabledLines: number[] = [];
  let offset = 0;

  for (const [lineIndex, lineWithEnding] of (source.match(/.*(?:\r?\n|$)/g) ?? []).entries()) {
    if (lineWithEnding.length === 0) {
      continue;
    }

    const line = lineWithEnding.replace(/\r?\n$/, "");
    const analysisLine = maskMarkdownInline(line);
    if (FILE_DISABLE_DIRECTIVE.test(analysisLine)) {
      return {
        filePath,
        source,
        sourceType: "text",
        lineStarts,
        blocks: [],
        hardWraps: [],
        disabledLines: [lineIndex + 1]
      };
    }
    if (LINE_DISABLE_DIRECTIVE.test(analysisLine)) {
      disabledLines.push(lineIndex + 1);
      offset += lineWithEnding.length;
      continue;
    }
    if (line.trim().length > 0) {
      blocks.push({
        kind: "plain",
        text: line,
        analysisText: analysisLine,
        range: [offset, offset + line.length],
        loc: locationAt(source, offset, offset + line.length, lineStarts)
      });
    }
    offset += lineWithEnding.length;
  }

  return { filePath, source, sourceType: "text", lineStarts, blocks, hardWraps: [], disabledLines };
}

export function parseDocument(filePath: string, source: string): Document {
  if (/\.(?:md|markdown|mdx)$/i.test(filePath)) {
    return parseMarkdown(source, filePath);
  }
  return parsePlainText(source, filePath);
}

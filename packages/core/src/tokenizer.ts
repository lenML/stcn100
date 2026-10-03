import type { Token, Tokenizer } from "./types.js";

function tokenKind(segment: string, wordLike: boolean): Token["kind"] {
  if (wordLike) {
    const number = /^(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]+)?$/u;
    return number.test(segment) ? "number" : "word";
  }
  if (/^\s+$/u.test(segment)) {
    return "space";
  }
  if (/^\p{P}+$/u.test(segment)) {
    return "punctuation";
  }
  if (/^\p{S}+$/u.test(segment)) {
    return "symbol";
  }
  return "symbol";
}

export class IntlWordTokenizer implements Tokenizer {
  readonly name = "intl-word";

  private readonly segmenter: Intl.Segmenter;

  constructor(locale = "zh-CN") {
    if (typeof Intl.Segmenter !== "function") {
      throw new Error("Intl.Segmenter is required. Use a Node.js build with full ICU.");
    }
    if (Intl.Segmenter.supportedLocalesOf([locale]).length === 0) {
      throw new Error(`Locale is not supported by Intl.Segmenter: ${locale}`);
    }
    this.segmenter = new Intl.Segmenter(locale, { granularity: "word" });
  }

  tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    for (const segment of this.segmenter.segment(text)) {
      tokens.push({
        text: segment.segment,
        start: segment.index,
        end: segment.index + segment.segment.length,
        kind: tokenKind(segment.segment, segment.isWordLike === true)
      });
    }
    return tokens;
  }
}

export const defaultTokenizer: Tokenizer = new IntlWordTokenizer();

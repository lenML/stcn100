import { definePlugin, type Preset } from "@stcn100/core";
import { clauseCountRule } from "./general/clause-count.js";
import { passiveVoiceRule } from "./general/passive-voice.js";
import { redundantConnectiveRule } from "./general/redundant-connective.js";
import { repeatedPunctuationRule } from "./general/repeated-punctuation.js";
import { sentenceLengthRule } from "./general/sentence-length.js";
import { terminologyRule } from "./general/terminology.js";
import { vagueTermRule } from "./general/vague-term.js";
import { actionNominalizationRule } from "./coding/action-nominalization.js";
import { futureTenseRule } from "./coding/future-tense.js";
import { possibilityLanguageRule } from "./coding/possibility-language.js";
import { contextWordRule } from "./lexical/context-word.js";
import { jargonRule } from "./lexical/jargon.js";
import { readerAddressRule } from "./lexical/reader-address.js";
import { termCasingRule } from "./lexical/term-casing.js";
import { termContextRule } from "./lexical/term-context.js";
import { typoRule } from "./lexical/typo.js";
import { quantityLogicRule } from "./numeric/quantity-logic.js";
import { paragraphHardWrapRule } from "./structure/paragraph-hard-wrap.js";
import { cjkLatinSpacingRule } from "./typography/cjk-latin-spacing.js";
import { numericSpacingRule } from "./typography/numeric-spacing.js";
import { pairedPunctuationRule } from "./typography/paired-punctuation.js";
import { punctuationStyleRule } from "./typography/punctuation-style.js";
import { quoteStyleRule } from "./typography/quote-style.js";

export const generalPreset: Preset = {
  name: "general",
  rules: {
    "sentence-length": ["warning", { suggestedMax: 30, hardMax: 40 }],
    "clause-count": ["warning", { max: 3 }],
    "vague-term": ["warning", {}],
    "repeated-punctuation": ["error", {}],
    "redundant-connective": ["warning", {}],
    "passive-voice": ["warning", {}],
    terminology: ["warning", { terms: [] }],
    typo: ["error", {}],
    "term-casing": ["warning", {}],
    "term-context": ["info", {}],
    "context-word": ["info", {}],
    "punctuation-style": ["warning", {}],
    "quote-style": ["warning", {}],
    "paired-punctuation": ["error", {}],
    "numeric-spacing": ["warning", {}],
    "quantity-logic": ["warning", {}],
    "cjk-latin-spacing": ["info", {}],
    jargon: ["info", {}],
    "reader-address": ["info", {}],
    "paragraph-hard-wrap": ["warning", {}]
  }
};

export const codingPreset: Preset = {
  name: "coding",
  extends: ["general"],
  rules: {
    "coding/future-tense": ["warning", {}],
    "coding/action-nominalization": ["warning", {}],
    "coding/possibility-language": ["warning", {}]
  }
};

export const builtinPlugin = definePlugin({
  name: "@stcn100/rules",
  rules: [
    sentenceLengthRule,
    clauseCountRule,
    vagueTermRule,
    repeatedPunctuationRule,
    redundantConnectiveRule,
    passiveVoiceRule,
    terminologyRule,
    typoRule,
    termCasingRule,
    termContextRule,
    contextWordRule,
    jargonRule,
    readerAddressRule,
    paragraphHardWrapRule,
    punctuationStyleRule,
    quoteStyleRule,
    pairedPunctuationRule,
    numericSpacingRule,
    quantityLogicRule,
    cjkLatinSpacingRule,
    futureTenseRule,
    actionNominalizationRule,
    possibilityLanguageRule
  ],
  presets: {
    general: generalPreset,
    coding: codingPreset
  }
});

export {
  actionNominalizationRule,
  clauseCountRule,
  cjkLatinSpacingRule,
  futureTenseRule,
  jargonRule,
  numericSpacingRule,
  passiveVoiceRule,
  possibilityLanguageRule,
  punctuationStyleRule,
  quoteStyleRule,
  pairedPunctuationRule,
  quantityLogicRule,
  readerAddressRule,
  paragraphHardWrapRule,
  redundantConnectiveRule,
  repeatedPunctuationRule,
  sentenceLengthRule,
  termCasingRule,
  termContextRule,
  contextWordRule,
  terminologyRule,
  typoRule,
  vagueTermRule
};

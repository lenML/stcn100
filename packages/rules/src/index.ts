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

export const generalPreset: Preset = {
  name: "general",
  rules: {
    "sentence-length": ["warning", { suggestedMax: 30, hardMax: 40 }],
    "clause-count": ["warning", { max: 3 }],
    "vague-term": ["warning", {}],
    "repeated-punctuation": ["error", {}],
    "redundant-connective": ["warning", {}],
    "passive-voice": ["warning", {}],
    terminology: ["warning", { terms: [] }]
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
  futureTenseRule,
  passiveVoiceRule,
  possibilityLanguageRule,
  redundantConnectiveRule,
  repeatedPunctuationRule,
  sentenceLengthRule,
  terminologyRule,
  vagueTermRule
};

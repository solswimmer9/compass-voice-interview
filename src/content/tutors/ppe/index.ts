import { PEDAGOGY_VERSION } from "../../core.ts";
import type { Tutor } from "../../types.ts";
import { PPE_CARDS } from "./cards/index.ts";
import {
  PPE_ASSUMED_KNOWLEDGE,
  PPE_PERSONA,
  PPE_READING_LIST,
  PPE_REASONING_GUIDE,
  PPE_STRANDS,
} from "./persona.ts";

export const PPE: Tutor = {
  id: "ppe",
  version: "0.6.0",
  pedagogyVersion: PEDAGOGY_VERSION,
  persona: PPE_PERSONA,
  strands: PPE_STRANDS,
  assumedKnowledge: PPE_ASSUMED_KNOWLEDGE,
  reasoningGuide: PPE_REASONING_GUIDE,
  readingList: PPE_READING_LIST,
  cards: PPE_CARDS,
};

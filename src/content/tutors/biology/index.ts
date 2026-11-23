import { PEDAGOGY_VERSION } from "../../core.ts";
import type { Tutor } from "../../types.ts";
import {
  BIOLOGY_ASSUMED_KNOWLEDGE,
  BIOLOGY_PERSONA,
  BIOLOGY_READING_LIST,
  BIOLOGY_REASONING_GUIDE,
  BIOLOGY_STRANDS,
} from "./persona.ts";

// No topic cards: Dr Toby's interviews come from roadmap scenarios (src/content/scenarios).
export const BIOLOGY: Tutor = {
  id: "biology",
  version: "1.0.0",
  pedagogyVersion: PEDAGOGY_VERSION,
  persona: BIOLOGY_PERSONA,
  strands: BIOLOGY_STRANDS,
  assumedKnowledge: BIOLOGY_ASSUMED_KNOWLEDGE,
  reasoningGuide: BIOLOGY_REASONING_GUIDE,
  readingList: BIOLOGY_READING_LIST,
  cards: [],
};

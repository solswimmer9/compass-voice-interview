import { PEDAGOGY_VERSION } from "../../core.ts";
import type { Tutor } from "../../types.ts";
import { GEOGRAPHY_CARDS } from "./cards/index.ts";
import {
  GEOGRAPHY_ASSUMED_KNOWLEDGE,
  GEOGRAPHY_PERSONA,
  GEOGRAPHY_READING_LIST,
  GEOGRAPHY_REASONING_GUIDE,
  GEOGRAPHY_STRANDS,
} from "./persona.ts";

export const GEOGRAPHY: Tutor = {
  id: "geography",
  version: "1.1.0",
  pedagogyVersion: PEDAGOGY_VERSION,
  persona: GEOGRAPHY_PERSONA,
  strands: GEOGRAPHY_STRANDS,
  assumedKnowledge: GEOGRAPHY_ASSUMED_KNOWLEDGE,
  reasoningGuide: GEOGRAPHY_REASONING_GUIDE,
  readingList: GEOGRAPHY_READING_LIST,
  cards: GEOGRAPHY_CARDS,
};

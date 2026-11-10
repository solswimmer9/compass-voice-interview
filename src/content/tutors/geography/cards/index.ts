// Every geography card, one file per card. Add a card: create <id>.ts, then import it here.
// The card lint test fails if a card file exists but is missing from this list.
import type { TopicCard } from "../../../types.ts";
import regenerationWhoFor from "./regeneration-who-for.ts";
import riverPerson from "./river-person.ts";
import volcanoEruptionStyles from "./volcano-eruption-styles.ts";

export const GEOGRAPHY_CARDS: TopicCard[] = [
  riverPerson,
  regenerationWhoFor,
  volcanoEruptionStyles,
];

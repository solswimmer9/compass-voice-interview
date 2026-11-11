// PPE cards. All are drafts written for the PPE trial (tester accounts only) and await the
// owner's review. Until at least one is approved, isTutorAvailable("ppe") stays false and no
// student can start a PPE interview; testers reach the drafts through the relay's PPE trial path.
import type { TopicCard } from "../../../types.ts";
import promiseToTheDead from "./promise-to-the-dead.ts";
import tellingTheTruth from "./telling-the-truth.ts";
import machineInPain from "./machine-in-pain.ts";
import sixteenYearOldsVote from "./sixteen-year-olds-vote.ts";
import mpsByLottery from "./mps-by-lottery.ts";
import offensiveSpeech from "./offensive-speech.ts";
import rentCapDayAfter from "./rent-cap-day-after.ts";
import ticketPricesFair from "./ticket-prices-fair.ts";
import bagCharge from "./bag-charge.ts";
import museumEntryFree from "./museum-entry-free.ts";

export const PPE_CARDS: TopicCard[] = [
  promiseToTheDead,
  tellingTheTruth,
  machineInPain,
  sixteenYearOldsVote,
  mpsByLottery,
  offensiveSpeech,
  rentCapDayAfter,
  ticketPricesFair,
  bagCharge,
  museumEntryFree,
];

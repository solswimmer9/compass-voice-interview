// PPE cards. All are drafts: ten written by Claude as placeholders, the rest restructured from
// Solomon's PPE interview pack (11 November 2026). Until at least one is approved,
// isTutorAvailable("ppe") stays false and no student can start a PPE interview; testers reach the
// drafts through the relay's PPE trial path.
import type { TopicCard } from "../../../types.ts";
import bagCharge from "./bag-charge.ts";
import budgetDoingLittle from "./budget-doing-little.ts";
import changingYourMind from "./changing-your-mind.ts";
import climateCollectiveAction from "./climate-collective-action.ts";
import climateConcernPolarised from "./climate-concern-polarised.ts";
import climateDebtPastEmissions from "./climate-debt-past-emissions.ts";
import democracyAndGrowth from "./democracy-and-growth.ts";
import distrustTheMessenger from "./distrust-the-messenger.ts";
import electionTiming from "./election-timing.ts";
import expertsOrVoters from "./experts-or-voters.ts";
import fairnessThreePrinciples from "./fairness-three-principles.ts";
import freeMovementRight from "./free-movement-right.ts";
import housingWaterPollution from "./housing-water-pollution.ts";
import infrastructureVeto from "./infrastructure-veto.ts";
import legalButWrong from "./legal-but-wrong.ts";
import lowerHousePrices from "./lower-house-prices.ts";
import machineInPain from "./machine-in-pain.ts";
import mixedNeighbourhoods from "./mixed-neighbourhoods.ts";
import mpsByLottery from "./mps-by-lottery.ts";
import museumEntryFree from "./museum-entry-free.ts";
import offensiveSpeech from "./offensive-speech.ts";
import organAllocation from "./organ-allocation.ts";
import politicalMyth from "./political-myth.ts";
import powerAndAuthority from "./power-and-authority.ts";
import practicalBeliefFreedom from "./practical-belief-freedom.ts";
import prepunishment from "./prepunishment.ts";
import promiseToTheDead from "./promise-to-the-dead.ts";
import referendumOrManifesto from "./referendum-or-manifesto.ts";
import rentCapDayAfter from "./rent-cap-day-after.ts";
import resistingEducation from "./resisting-education.ts";
import rightsOutweighBenefit from "./rights-outweigh-benefit.ts";
import roughSleeping from "./rough-sleeping.ts";
import schoolingForMarriage from "./schooling-for-marriage.ts";
import sixteenYearOldsVote from "./sixteen-year-olds-vote.ts";
import stateApology from "./state-apology.ts";
import tellingTheTruth from "./telling-the-truth.ts";
import testingElectionCauses from "./testing-election-causes.ts";
import ticketPricesFair from "./ticket-prices-fair.ts";
import welfareCutsFair from "./welfare-cuts-fair.ts";
import whatIsAProblem from "./what-is-a-problem.ts";

export const PPE_CARDS: TopicCard[] = [
  bagCharge,
  budgetDoingLittle,
  changingYourMind,
  climateCollectiveAction,
  climateConcernPolarised,
  climateDebtPastEmissions,
  democracyAndGrowth,
  distrustTheMessenger,
  electionTiming,
  expertsOrVoters,
  fairnessThreePrinciples,
  freeMovementRight,
  housingWaterPollution,
  infrastructureVeto,
  legalButWrong,
  lowerHousePrices,
  machineInPain,
  mixedNeighbourhoods,
  mpsByLottery,
  museumEntryFree,
  offensiveSpeech,
  organAllocation,
  politicalMyth,
  powerAndAuthority,
  practicalBeliefFreedom,
  prepunishment,
  promiseToTheDead,
  referendumOrManifesto,
  rentCapDayAfter,
  resistingEducation,
  rightsOutweighBenefit,
  roughSleeping,
  schoolingForMarriage,
  sixteenYearOldsVote,
  stateApology,
  tellingTheTruth,
  testingElectionCauses,
  ticketPricesFair,
  welfareCutsFair,
  whatIsAProblem,
];

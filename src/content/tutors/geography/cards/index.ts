// Every geography card, one file per card. Add a card: create <id>.ts, then import it here.
// The card lint test fails if a card file exists but is missing from this list.
import type { TopicCard } from "../../../types.ts";
import riverPerson from "./river-person.ts";
import regenerationWhoFor from "./regeneration-who-for.ts";
import volcanoEruptionStyles from "./volcano-eruption-styles.ts";
import riverNaturalOrHuman from "./river-natural-or-human.ts";
import outdoorsOwnership from "./outdoors-ownership.ts";
import mapHides from "./map-hides.ts";
import buildingArgument from "./building-argument.ts";
import actingLocally from "./acting-locally.ts";
import disasterNatural from "./disaster-natural.ts";
import climateEmergency from "./climate-emergency.ts";
import localArea from "./local-area.ts";
import legalRightLocation from "./legal-right-location.ts";
import organisationalResponsibility from "./organisational-responsibility.ts";
import aiClimate from "./ai-climate.ts";
import placeChangedThinking from "./place-changed-thinking.ts";
import borderLineOrProcess from "./border-line-or-process.ts";
import citiesWhere from "./cities-where.ts";
import rewildBritain from "./rewild-britain.ts";
import fairTradeBananas from "./fair-trade-bananas.ts";
import pastTemperature from "./past-temperature.ts";
import courtImpressive from "./court-impressive.ts";
import hopefulAndAngry from "./hopeful-and-angry.ts";
import footballerWar from "./footballer-war.ts";
import townVote from "./town-vote.ts";
import cityEverFinished from "./city-ever-finished.ts";
import inequalityPostcode from "./inequality-postcode.ts";
import migrantWhen from "./migrant-when.ts";
import developingWhoDecides from "./developing-who-decides.ts";
import sameVirusDifferentPandemics from "./same-virus-different-pandemics.ts";
import foodExportHunger from "./food-export-hunger.ts";
import geopoliticsArctic from "./geopolitics-arctic.ts";
import colonialPlaceNames from "./colonial-place-names.ts";
import oldIceLandscape from "./old-ice-landscape.ts";
import hazardsCityVolcano from "./hazards-city-volcano.ts";
import weatherWorseOrExposed from "./weather-worse-or-exposed.ts";
import nativeSpecies from "./native-species.ts";
import treesClimateSolution from "./trees-climate-solution.ts";
import statisticLimits from "./statistic-limits.ts";

export const GEOGRAPHY_CARDS: TopicCard[] = [
  riverPerson,
  regenerationWhoFor,
  volcanoEruptionStyles,
  riverNaturalOrHuman,
  outdoorsOwnership,
  mapHides,
  buildingArgument,
  actingLocally,
  disasterNatural,
  climateEmergency,
  localArea,
  legalRightLocation,
  organisationalResponsibility,
  aiClimate,
  placeChangedThinking,
  borderLineOrProcess,
  citiesWhere,
  rewildBritain,
  fairTradeBananas,
  pastTemperature,
  courtImpressive,
  hopefulAndAngry,
  footballerWar,
  townVote,
  cityEverFinished,
  inequalityPostcode,
  migrantWhen,
  developingWhoDecides,
  sameVirusDifferentPandemics,
  foodExportHunger,
  geopoliticsArctic,
  colonialPlaceNames,
  oldIceLandscape,
  hazardsCityVolcano,
  weatherWorseOrExposed,
  nativeSpecies,
  treesClimateSolution,
  statisticLimits,
];

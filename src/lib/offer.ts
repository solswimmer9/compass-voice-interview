export const FREE_INTERVIEWS = 1;
export const INTERVIEW_PACK = {
  productId: "interview_pack_2",
  priceId: "interview_pack_2_gbp",
  name: "2-Interview Pack",
  description: "Two full geography voice interviews, each with AI reasoning feedback.",
  amountMinor: 2000,
  currency: "gbp",
  displayPrice: "£20",
  interviews: 2,
} as const;

// Lifetime access is stored as a purchase with a very large interview count, so the
// existing database credit rules (consume, refund, one feedback per interview) apply
// unchanged. The payment product must exist with this price ID.
export const LIFETIME_INTERVIEWS = 100_000;
export const LIFETIME_ACCESS = {
  productId: "lifetime_access",
  priceId: "lifetime_access_gbp",
  name: "Lifetime access",
  description:
    "Unlimited geography voice interviews with Dr River, each with AI reasoning feedback.",
  amountMinor: 10000,
  currency: "gbp",
  displayPrice: "£100",
  interviews: LIFETIME_INTERVIEWS,
} as const;

export const SCHOOL_BUNDLE = {
  productId: "school_interview_bundle",
  priceId: "school_bundle_30_gbp",
  name: "School Interview Bundle",
  description:
    "30 shared interviews with AI feedback for up to 30 students, until the next 31 August.",
  amountMinor: 125000,
  currency: "gbp",
  displayPrice: "£1,250",
  interviews: 30,
  maxStudents: 30,
} as const;

export const OFFERS = [INTERVIEW_PACK, LIFETIME_ACCESS, SCHOOL_BUNDLE] as const;
export type Offer = (typeof OFFERS)[number];

export function offerForPriceId(priceId: unknown): Offer | undefined {
  return OFFERS.find((offer) => offer.priceId === priceId);
}

export function offerForProductId(productId: unknown): Offer | undefined {
  return OFFERS.find((offer) => offer.productId === productId);
}

/** Temporary switch: when true, no new purchases can start (buttons disabled, server rejects checkout). */
export const PURCHASES_PAUSED = true;

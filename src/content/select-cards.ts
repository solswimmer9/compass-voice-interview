// Card selection, per "Card selection" in docs/context-layer-spec.md. Pure; server-only.
import type { CardDone, TopicCard, Tutor } from "./types.ts";

export type SelectCardsOptions = {
  /** Restrict to one strand, e.g. "physical". Unknown strands give no cards. */
  strand?: string;
  /**
   * Makes the choice deterministic. Any non-negative safe integer, e.g. the browser's rising
   * openingTurn, so one device rotates through cards before repeating. Without it the first
   * card is chosen at random.
   */
  seed?: number;
  /** Total cards wanted, 1 to 3. Default 3. */
  count?: number;
  /**
   * Also consider draft cards. Only for tester-only experiments (the PPE trial); never set it for
   * an interview a paying student can start.
   */
  includeDrafts?: boolean;
};

function validSeed(seed: unknown): number | undefined {
  return typeof seed === "number" && Number.isSafeInteger(seed) && seed >= 0 ? seed : undefined;
}

function pick<T>(list: readonly T[], seed: number | undefined): T | undefined {
  if (!list.length) return undefined;
  const index = seed === undefined ? Math.floor(Math.random() * list.length) : seed % list.length;
  return list[index];
}

/** Latest time each card was done, in ms. Entries with bad dates count as done long ago. */
function lastDone(history: readonly CardDone[]): Map<string, number> {
  const done = new Map<string, number>();
  for (const entry of history) {
    if (!entry || typeof entry.id !== "string") continue;
    const at = Date.parse(entry.at);
    const time = Number.isFinite(at) ? at : 0;
    done.set(entry.id, Math.max(done.get(entry.id) ?? -Infinity, time));
  }
  return done;
}

/**
 * Chooses 1-3 approved cards for an interview. cards[0] is the opening card.
 * 1. Candidates: approved cards for the tutor, filtered by strand if given.
 * 2. First card: one not yet done (chosen by seed, else at random); if all are done, the least
 *    recently done.
 * 3. Then up to count-1 more from the first card's `related`, ranked not-done first, then a
 *    different strand from the first card, then least recently done, then `related` order.
 *    If `related` runs out, the rest of the candidates fill in by the same ranking.
 * Drafts are never returned unless includeDrafts is set (tester-only experiments).
 */
export function selectCards(
  tutor: Tutor,
  history: readonly CardDone[] = [],
  options: SelectCardsOptions = {},
): TopicCard[] {
  const count = Math.min(3, Math.max(1, Math.trunc(options.count ?? 3)));
  const seed = validSeed(options.seed);
  const candidates = tutor.cards.filter(
    (card) =>
      (card.status === "approved" || options.includeDrafts === true) &&
      card.tutor === tutor.id &&
      (options.strand === undefined || card.strand === options.strand),
  );
  if (!candidates.length) return [];

  const done = lastDone(history);
  const notDone = candidates.filter((card) => !done.has(card.id));
  const first =
    pick(notDone, seed) ??
    [...candidates].sort((a, b) => (done.get(a.id) ?? 0) - (done.get(b.id) ?? 0))[0];
  if (!first) return [];

  const rank = (card: TopicCard) => [
    done.has(card.id) ? 1 : 0,
    card.strand === first.strand ? 1 : 0,
    done.get(card.id) ?? 0,
  ];
  const byRank = (cards: TopicCard[]) =>
    cards
      .map((card, order) => ({ card, key: [...rank(card), order] }))
      .sort((a, b) => {
        for (let i = 0; i < a.key.length; i++) {
          const diff = (a.key[i] ?? 0) - (b.key[i] ?? 0);
          if (diff) return diff;
        }
        return 0;
      })
      .map(({ card }) => card);

  const byId = new Map(candidates.map((card) => [card.id, card]));
  const related = first.related
    .map((id) => byId.get(id))
    .filter(
      (card, index, list): card is TopicCard =>
        !!card && card.id !== first.id && list.indexOf(card) === index,
    );
  const relatedIds = new Set(related.map((card) => card.id));
  const others = candidates.filter((card) => card.id !== first.id && !relatedIds.has(card.id));

  return [first, ...byRank(related), ...byRank(others)].slice(0, count);
}

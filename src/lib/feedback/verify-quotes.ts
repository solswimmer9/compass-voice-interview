import type { Evidence, Observation, Turn } from "./types";

/**
 * Lower-case, unify quotes and dashes, strip punctuation, collapse whitespace.
 * Apostrophes are removed (not spaced) so "don't" and "don’t" both become "dont".
 */
export function normalise(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2018\u2019\u201B\u02BC`´']/g, "")
    .replace(/[\u2010-\u2015\u2212]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type VerifiedEvidence = Evidence & { corrected?: true };
export type VerifiedObservation = Omit<Observation, "evidence"> & {
  evidence: VerifiedEvidence[];
  droppedEvidence?: { turn: number; quote: string; reason: string }[];
};
export type DroppedObservation = { observation: unknown; reason: string };
export type VerifyOptions = { minWords?: number };
export type VerifyResult = { verified: VerifiedObservation[]; dropped: DroppedObservation[] };

const DEFAULT_MIN_WORDS = 4;

function countWords(normalised: string): number {
  return normalised ? normalised.split(" ").length : 0;
}

/** Substring match on word boundaries, so "art" does not match inside "party". */
function containsPhrase(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}

export function verifyObservations(
  observations: Observation[],
  turns: Turn[],
  options: VerifyOptions = {},
): VerifyResult {
  const verified: VerifiedObservation[] = [];
  const dropped: DroppedObservation[] = [];
  const minWords =
    typeof options?.minWords === "number" && options.minWords >= 1 ? options.minWords : DEFAULT_MIN_WORDS;
  const safeTurns: Turn[] = Array.isArray(turns)
    ? turns.filter((t) => t && typeof t.turn === "number" && typeof t.text === "string")
    : [];
  const byNumber = new Map<number, Turn>();
  for (const t of safeTurns) if (!byNumber.has(t.turn)) byNumber.set(t.turn, t);
  const normalisedText = new Map<Turn, string>();
  const norm = (t: Turn) => {
    let n = normalisedText.get(t);
    if (n === undefined) normalisedText.set(t, (n = normalise(t.text)));
    return n;
  };

  for (const obs of Array.isArray(observations) ? observations : []) {
    if (!obs || typeof obs !== "object" || !Array.isArray((obs as Observation).evidence)) {
      dropped.push({ observation: obs, reason: "malformed observation" });
      continue;
    }
    const kept: VerifiedEvidence[] = [];
    const droppedEvidence: { turn: number; quote: string; reason: string }[] = [];
    const keptTurns: Turn[] = [];

    for (const ev of obs.evidence) {
      if (!ev || typeof ev.quote !== "string" || typeof ev.turn !== "number") {
        droppedEvidence.push({ turn: (ev as Evidence)?.turn, quote: (ev as Evidence)?.quote, reason: "malformed evidence" });
        continue;
      }
      const q = normalise(ev.quote);
      if (countWords(q) < minWords) {
        droppedEvidence.push({ ...ev, reason: `quote shorter than ${minWords} words` });
        continue;
      }
      const named = byNumber.get(ev.turn);
      if (named && named.role === "user" && containsPhrase(norm(named), q)) {
        kept.push({ turn: ev.turn, quote: ev.quote });
        keptTurns.push(named);
        continue;
      }
      // Wrong turn number or wrong role: look for a single student turn containing it.
      const matches = safeTurns.filter((t) => t.role === "user" && containsPhrase(norm(t), q));
      const only = matches.length === 1 ? matches[0] : undefined;
      if (only) {
        kept.push({ turn: only.turn, quote: ev.quote, corrected: true });
        keptTurns.push(only);
      } else if (named && named.role !== "user") {
        droppedEvidence.push({ ...ev, reason: "turn is not a student turn" });
      } else if (matches.length > 1) {
        droppedEvidence.push({ ...ev, reason: "quote appears in several student turns; turn number is wrong" });
      } else {
        droppedEvidence.push({ ...ev, reason: named ? "quote not found in the named turn" : "turn does not exist" });
      }
    }

    let finalEvidence = kept;
    if (obs.kind === "improvement") {
      // An improvement may never lean on a turn the speech recognition flagged as unclear.
      const clear = kept.filter((_, i) => !keptTurns[i]?.unclear);
      for (const e of kept) if (!clear.includes(e)) droppedEvidence.push({ turn: e.turn, quote: e.quote, reason: "turn marked unclear" });
      finalEvidence = clear;
    }

    if (finalEvidence.length === 0) {
      const reasons = [...new Set(droppedEvidence.map((d) => d.reason))];
      dropped.push({
        observation: obs,
        reason: obs.evidence.length === 0 ? "no evidence supplied" : `no surviving evidence (${reasons.join("; ")})`,
      });
      continue;
    }
    const out: VerifiedObservation = { ...obs, evidence: finalEvidence };
    if (droppedEvidence.length) out.droppedEvidence = droppedEvidence;
    verified.push(out);
  }
  return { verified, dropped };
}

/** True when too few observations survived verification to support a report. */
export function tooThinToAssess(verified: unknown[]): boolean {
  return !Array.isArray(verified) || verified.length < 2;
}

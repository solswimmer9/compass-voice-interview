// Structured student context: dated, evidence-linked observations per subject, with expiry.
// Pure functions. See architecture document section 7. Guards against permanent labels:
// no evidence means no observation; to_develop and misconception observations expire.
import type { StudentMemory } from "@/content/types";
import { findSlop } from "@/lib/feedback/slop";
import type { VerifiedObservation } from "@/lib/feedback/verify-quotes";
import type { Difficulty, StudentContext, StudentObservation } from "./types";

export const NOTE_MAX_WORDS = 20;
export const EXPIRY_INTERVIEWS = 3;
export const EXPIRY_DAYS = 90;
const MAX_EVIDENCE_PER_OBSERVATION = 5;
const MEMORY_ITEMS = 3;
const DAY_MS = 86_400_000;

function capWords(text: string, max: number): string {
  return (
    String(text ?? "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/gu, " ")
      .split(/\s+/u)
      .filter(Boolean)
      .slice(0, max)
      .join(" ")
  );
}

function clampDifficulty(n: number): Difficulty {
  const r = Math.round(Number.isFinite(n) ? n : 2);
  return Math.min(4, Math.max(1, r)) as Difficulty;
}

export function emptyStudentContext(subjectId: string): StudentContext {
  return { subjectId, interviews: 0, cardsDone: [], observations: [], sustainedDifficulty: 2 };
}

export type RejectedObservation = { observationId: string; reason: string };

/**
 * Merges one interview's verified observations into the context. Does not mutate `previous`.
 * - Kinds map strength to demonstrated and improvement to to_develop.
 * - knowledge_gap observations are skipped: a missing fact is not a reasoning observation, and
 *   the pedagogy document forbids presenting one as a flaw in thinking.
 * - An observation with no evidence is rejected.
 * - Same criterion and kind: evidence is merged (newest five kept), note and lastSeen refresh.
 * - A different subject throws: context is per subject.
 */
export function updateStudentContext(
  previous: StudentContext | null,
  input: {
    subjectId: string;
    interviewId: string;
    at: string;
    cardIds: string[];
    verified: VerifiedObservation[];
    sustainedDifficulty: Difficulty;
  },
): { context: StudentContext; rejected: RejectedObservation[] } {
  if (previous && previous.subjectId !== input.subjectId) {
    throw new Error(
      `Student context is per subject: have ${previous.subjectId}, got ${input.subjectId}`,
    );
  }
  const base = previous ?? emptyStudentContext(input.subjectId);
  const observations: StudentObservation[] = base.observations.map((o) => ({
    ...o,
    evidence: o.evidence.map((e) => ({ ...e })),
  }));
  const rejected: RejectedObservation[] = [];

  for (const obs of input.verified ?? []) {
    const evidence = (Array.isArray(obs?.evidence) ? obs.evidence : [])
      .filter((e) => e && typeof e.quote === "string" && e.quote.trim() && Number.isInteger(e.turn))
      .map((e) => ({ interviewId: input.interviewId, turn: e.turn, quote: e.quote }));
    if (evidence.length === 0) {
      rejected.push({ observationId: obs?.id ?? "", reason: "no evidence" });
      continue;
    }
    if (obs.kind === "knowledge_gap") {
      rejected.push({
        observationId: obs.id,
        reason: "knowledge gaps are not stored as reasoning observations",
      });
      continue;
    }
    const kind = obs.kind === "strength" ? "demonstrated" : "to_develop";
    const note = capWords(obs.claim, NOTE_MAX_WORDS);
    if (!note) {
      rejected.push({ observationId: obs.id, reason: "empty note" });
      continue;
    }
    const existing = observations.find((o) => o.criterionId === obs.criterionId && o.kind === kind);
    if (existing) {
      for (const e of evidence) {
        const dup = existing.evidence.some(
          (x) => x.interviewId === e.interviewId && x.turn === e.turn && x.quote === e.quote,
        );
        if (!dup) existing.evidence.push(e);
      }
      existing.evidence = existing.evidence.slice(-MAX_EVIDENCE_PER_OBSERVATION);
      existing.note = note;
      existing.lastSeen = input.at;
    } else {
      observations.push({
        criterionId: obs.criterionId,
        kind,
        note,
        evidence: evidence.slice(-MAX_EVIDENCE_PER_OBSERVATION),
        lastSeen: input.at,
      });
    }
  }

  const cardsDone = base.cardsDone.map((c) => ({ ...c }));
  for (const id of input.cardIds ?? []) {
    if (!cardsDone.some((c) => c.id === id && c.at === input.at)) {
      cardsDone.push({ id, at: input.at });
    }
  }

  return {
    context: {
      subjectId: base.subjectId,
      interviews: base.interviews + 1,
      cardsDone,
      observations,
      sustainedDifficulty: clampDifficulty(input.sustainedDifficulty),
    },
    rejected,
  };
}

/** Builds an `interviewsSince` function from the dates of a student's interviews in a subject. */
export function interviewsAfter(interviewDates: string[]): (lastSeen: string) => number {
  const times = interviewDates.map((d) => Date.parse(d)).filter(Number.isFinite);
  return (lastSeen) => {
    const seen = Date.parse(lastSeen);
    return times.filter((t) => t > seen).length;
  };
}

/**
 * Drops to_develop and misconception observations that have gone stale: three or more later
 * interviews in the subject, or 90 or more days, since they were last seen. A re-seen
 * observation has a fresh lastSeen, so it stays. `demonstrated` never expires.
 * `interviewsSince` is a number applied to every observation, or a function of lastSeen
 * (see `interviewsAfter`).
 */
export function expireObservations(
  context: StudentContext,
  options: { now: Date; interviewsSince: number | ((lastSeen: string) => number) },
): { context: StudentContext; expired: StudentObservation[] } {
  const kept: StudentObservation[] = [];
  const expired: StudentObservation[] = [];
  for (const o of context.observations) {
    if (o.kind === "demonstrated") {
      kept.push(o);
      continue;
    }
    const later =
      typeof options.interviewsSince === "function"
        ? options.interviewsSince(o.lastSeen)
        : options.interviewsSince;
    const ageDays = (options.now.getTime() - Date.parse(o.lastSeen)) / DAY_MS;
    if (later >= EXPIRY_INTERVIEWS || ageDays >= EXPIRY_DAYS) expired.push(o);
    else kept.push(o);
  }
  return { context: { ...context, observations: kept }, expired };
}

/** The level held last time, never higher; 2 for a new student. */
export function startingDifficulty(context: StudentContext | null | undefined): Difficulty {
  return context ? clampDifficulty(context.sustainedDifficulty) : 2;
}

function newestFirst(list: StudentObservation[]): StudentObservation[] {
  return [...list].sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen));
}

/** Converts to the existing StudentMemory shape so renderMemory can be used unchanged. */
export function toStudentMemory(context: StudentContext): StudentMemory {
  const strengths = newestFirst(context.observations.filter((o) => o.kind === "demonstrated"));
  const habits = newestFirst(context.observations.filter((o) => o.kind !== "demonstrated"));
  return {
    interviews: context.interviews,
    cardsDone: context.cardsDone.map((c) => ({ ...c })),
    strengths: strengths.slice(0, MEMORY_ITEMS).map((o) => o.note),
    habits: habits.slice(0, MEMORY_ITEMS).map((o) => o.note),
    nextFocus: habits[0]?.note ?? "",
  };
}

function usable(note: string): boolean {
  return note.length > 0 && findSlop(note).length === 0;
}

/**
 * Plain, second-person summary the student could be shown. It reports what they did in the
 * interviews, with their own words, and says how it is used and when it fades. Notes that trip
 * the character-label or other slop checks are left out.
 */
export function describeForStudent(context: StudentContext): string {
  const lines: string[] = [];
  const count = context.interviews;
  const subject = context.subjectId;
  if (count === 0 || context.observations.length === 0) {
    lines.push(
      count === 0
        ? `We have no notes from earlier ${subject} interviews yet.`
        : `We have no notes to carry forward from your ${count} ${subject} interview${count === 1 ? "" : "s"}.`,
    );
  } else {
    lines.push(
      `From your ${count} ${subject} interview${count === 1 ? "" : "s"}, here is what we noted about your reasoning, each point tied to something you said:`,
    );
    const label = {
      demonstrated: "Something you did well",
      to_develop: "Something to practise next time",
      misconception: "An idea worth checking",
    } as const;
    for (const o of newestFirst(context.observations)) {
      const note = capWords(o.note, NOTE_MAX_WORDS).replace(/[.\s]+$/u, "");
      if (!usable(note)) continue;
      const quote = capWords(o.evidence[0]?.quote ?? "", 25);
      lines.push(`- ${label[o.kind]}: ${note}.${quote ? ` You said: "${quote}"` : ""}`);
    }
  }
  lines.push(
    `We use this only to choose your questions. Points to practise fade after ${EXPIRY_INTERVIEWS} more interviews or ${EXPIRY_DAYS} days unless they come up again, and you can delete all of it at any time.`,
  );
  return lines.join("\n");
}

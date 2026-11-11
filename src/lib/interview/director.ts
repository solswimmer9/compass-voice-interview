// Pure, deterministic phase director. See docs/multi-subject-interview-architecture.md section 6
// and docs/interview-pedagogy.md ("Difficulty and pressure").
//
// The relay feeds it elapsed time and, after each student turn, the analyst's TurnState. It
// returns the new state and, sometimes, a steering note for the live tutor. No model calls,
// no clock, no I/O: the same inputs always give the same output.
import type { Difficulty, Move, Phase, SteeringNote, TurnState, TutorFlag } from "./types";

export const MAX_NOTE_WORDS = 60;
/** The gateway rejects appends of 480 bytes or more. */
export const MAX_NOTE_BYTES = 480;

/** Fraction of the interview at which each phase ends on time alone. */
const PHASE_END: Record<Exclude<Phase, "closure">, number> = {
  opening: 0.1,
  comprehension: 0.18,
  baseline: 0.25,
  probing: 0.5,
  challenge: 0.8,
  synthesis: 0.95,
};

const PRESSURE_MOVES: Move[] = [
  "counterexample",
  "change_condition",
  "steelman",
  "rival_interpretation",
];

export type DirectorState = {
  minutes: number;
  hasStimulus: boolean;
  phase: Phase;
  difficulty: Difficulty;
  /** Turn states received so far, usable or not. */
  turn: number;
  turnsInPhase: number;
  /** Usable (clear) turns analysed in the current phase. */
  evidenceTurnsInPhase: number;
  upStreak: number;
  stallStreak: number;
  scaffoldTried: boolean;
  /** Tutor flags seen and not yet sent to the tutor. */
  pendingFlags: TutorFlag[];
  /** Value of `turn` when the last note was sent; null if none yet. */
  lastNoteTurn: number | null;
  care: "none" | "slow" | "closed";
  finished: boolean;
};

export type AdvanceInput = {
  elapsedMs: number;
  turnState?: TurnState | undefined;
  /** From the relay: the student said they want to stop, or showed distress. */
  care?: "distress" | "stop_request" | undefined;
};

export function createDirector(options: {
  minutes: number;
  hasStimulus: boolean;
  startingDifficulty?: Difficulty;
}): DirectorState {
  const minutes = Number.isFinite(options.minutes) && options.minutes > 0 ? options.minutes : 20;
  return {
    minutes,
    hasStimulus: Boolean(options.hasStimulus),
    phase: "opening",
    difficulty: clampDifficulty(options.startingDifficulty ?? 2),
    turn: 0,
    turnsInPhase: 0,
    evidenceTurnsInPhase: 0,
    upStreak: 0,
    stallStreak: 0,
    scaffoldTried: false,
    pendingFlags: [],
    lastNoteTurn: null,
    care: "none",
    finished: false,
  };
}

function clampDifficulty(n: number): Difficulty {
  const r = Math.round(Number.isFinite(n) ? n : 2);
  return Math.min(4, Math.max(1, r)) as Difficulty;
}

export function phaseSequence(hasStimulus: boolean): Phase[] {
  return hasStimulus
    ? ["opening", "comprehension", "baseline", "probing", "challenge", "synthesis", "closure"]
    : ["opening", "baseline", "probing", "challenge", "synthesis", "closure"];
}

function phaseAtTime(state: DirectorState, elapsedMs: number): Phase {
  const fraction = elapsedMs / (state.minutes * 60_000);
  for (const phase of phaseSequence(state.hasStimulus)) {
    if (phase === "closure") return "closure";
    if (fraction < PHASE_END[phase]) return phase;
  }
  return "closure";
}

function indexOf(state: DirectorState, phase: Phase): number {
  return phaseSequence(state.hasStimulus).indexOf(phase);
}

function evidenceExit(state: DirectorState, ts: TurnState | undefined): boolean {
  if (!ts || ts.transcriptUnclear) return false;
  const ev = ts.studentEvidence;
  switch (state.phase) {
    case "opening":
    case "comprehension":
      return ev.gaveReason || ev.usedExample;
    case "baseline":
      return state.evidenceTurnsInPhase >= 2;
    case "probing":
      return ev.handledChallenge === "revised" || ev.handledChallenge === "defended";
    case "synthesis":
      return (ts.tutorMove === "consolidate" || ts.tutorMove === "reflect") && ev.gaveReason;
    default:
      return false;
  }
}

function enterPhase(state: DirectorState, phase: Phase): void {
  state.phase = phase;
  state.turnsInPhase = 0;
  state.evidenceTurnsInPhase = 0;
}

/** Up is not allowed while settling in, wrapping up, or when the student is distressed. */
function mayRaise(state: DirectorState): boolean {
  return (
    state.care === "none" &&
    (state.phase === "baseline" || state.phase === "probing" || state.phase === "challenge")
  );
}

function setDifficulty(state: DirectorState, level: Difficulty): boolean {
  if (level === state.difficulty) return false;
  state.difficulty = level;
  state.upStreak = 0;
  state.stallStreak = 0;
  state.scaffoldTried = false;
  return true;
}

/**
 * Moves the interview forward. `state` is not mutated.
 * Notes are sent on a phase change, a difficulty change or scaffold request, and on care, always.
 * Tutor-flag corrections wait until at least two turns have passed since the last note, unless
 * they can ride along with another note.
 */
export function advance(
  previous: DirectorState,
  input: AdvanceInput,
): { state: DirectorState; note?: SteeringNote } {
  const state: DirectorState = { ...previous, pendingFlags: [...previous.pendingFlags] };
  const elapsedMs = Number.isFinite(input.elapsedMs) && input.elapsedMs > 0 ? input.elapsedMs : 0;
  const ts = input.turnState;
  if (ts) {
    state.turn += 1;
    state.turnsInPhase += 1;
  }

  // Care overrides everything else.
  if (input.care) {
    const wasClosedByCare = previous.care === "closed";
    const close =
      input.care === "stop_request" || previous.care === "slow" || previous.care === "closed";
    state.difficulty = 1;
    state.upStreak = 0;
    state.stallStreak = 0;
    state.scaffoldTried = false;
    state.pendingFlags = [];
    state.care = close ? "closed" : "slow";
    if (close && state.phase !== "closure") enterPhase(state, "closure");
    if (wasClosedByCare && previous.phase === "closure" && previous.difficulty === 1) {
      return { state }; // already asked to wrap up gently; nothing new to say
    }
    return { state: sent(state), note: careNote(state) };
  }

  let difficultyChanged = false;
  let scaffoldRequested = false;
  const phaseBefore = state.phase;

  const usable = ts !== undefined && !ts.transcriptUnclear;
  if (ts && usable) {
    state.evidenceTurnsInPhase += 1;
    for (const flag of flagsOf(ts)) {
      if (!state.pendingFlags.includes(flag)) state.pendingFlags.push(flag);
    }
    const ev = ts.studentEvidence;
    if (ts.tutorMove === "scaffold") state.scaffoldTried = true;
    if (ev.gaveReason) state.scaffoldTried = false;

    const handled = ev.handledChallenge === "revised" || ev.handledChallenge === "defended";
    const reasoned = ev.gaveReason && handled;
    const stalled = !ev.gaveReason && !handled;
    state.upStreak = reasoned ? state.upStreak + 1 : 0;
    state.stallStreak = stalled ? state.stallStreak + 1 : 0;

    if (state.upStreak >= 2 && state.difficulty < 4 && mayRaise(state)) {
      difficultyChanged = setDifficulty(state, (state.difficulty + 1) as Difficulty);
    } else if (state.stallStreak >= 2 && state.difficulty > 1 && state.phase !== "closure") {
      if (state.scaffoldTried) {
        difficultyChanged = setDifficulty(state, (state.difficulty - 1) as Difficulty);
      } else if (state.stallStreak % 2 === 0) {
        scaffoldRequested = true;
      }
    }
  }

  // Phase: one evidence step, then catch up with the clock.
  if (state.phase !== "closure" && state.care === "none" && evidenceExit(state, ts)) {
    const seq = phaseSequence(state.hasStimulus);
    enterPhase(state, seq[seq.indexOf(state.phase) + 1] ?? "closure");
  }
  const byTime = phaseAtTime(state, elapsedMs);
  if (indexOf(state, byTime) > indexOf(state, state.phase)) enterPhase(state, byTime);
  if (elapsedMs >= state.minutes * 60_000) {
    state.finished = true;
    if (state.phase !== "closure") enterPhase(state, "closure");
  }
  const phaseChanged = state.phase !== phaseBefore;

  // Decide whether to speak.
  const gapOk = state.lastNoteTurn === null || state.turn - state.lastNoteTurn >= 2;
  const strong = phaseChanged || difficultyChanged || scaffoldRequested;
  const corrections = state.pendingFlags.length > 0 && (strong || gapOk);
  if (!strong && !corrections) return { state };

  const note: SteeringNote = {
    reason: phaseChanged
      ? "phase"
      : difficultyChanged || scaffoldRequested
        ? "difficulty"
        : "correction",
    text: "",
    expect: {
      ...(phaseChanged ? { phase: state.phase } : {}),
      ...(difficultyChanged || scaffoldRequested ? { difficulty: state.difficulty } : {}),
      ...(scaffoldRequested ? { move: "scaffold" as const } : {}),
      ...(corrections ? { avoidFlags: [...state.pendingFlags] } : {}),
    },
  };
  note.text = steeringText(note);
  if (corrections) state.pendingFlags = [];
  return { state: sent(state), note };
}

function sent(state: DirectorState): DirectorState {
  state.lastNoteTurn = state.turn;
  return state;
}

function flagsOf(ts: TurnState): TutorFlag[] {
  const out: TutorFlag[] = [];
  if (ts.tutorFlags.leading) out.push("leading");
  if (ts.tutorFlags.lectured) out.push("lectured");
  if (ts.tutorFlags.offTopic) out.push("offTopic");
  if (ts.tutorFlags.ignoredStudent) out.push("ignoredStudent");
  return out;
}

function careNote(state: DirectorState): SteeringNote {
  const close = state.care === "closed";
  const note: SteeringNote = {
    reason: "care",
    text: "",
    expect: close
      ? { care: "close", phase: "closure", difficulty: 1, avoidMoves: PRESSURE_MOVES }
      : { care: "slow", difficulty: 1, avoidMoves: PRESSURE_MOVES },
  };
  note.text = steeringText(note);
  return note;
}

// ---------------------------------------------------------------------------------------------
// Steering text. Subject-neutral, plain language, to the live tutor.

const PHASE_TEXT: Record<Phase, string> = {
  opening: "Greet them warmly and ask one easy opening question. Let them settle.",
  comprehension: "Let them read the material, then ask what they notice. Do not explain it.",
  baseline: "Find their starting level with two or three open follow-ups on what they said.",
  probing: "Test one of their claims: ask what it assumes, or what evidence would support it.",
  challenge:
    "Raise the pressure: give a counterexample, change one condition, or ask for the strongest case against their view.",
  synthesis: "Ask them where they have got to and what moved them. Give no view of your own.",
  closure: "Wrap up. Thank them, say what happens next, give no verdict, and ask nothing new.",
};

const DIFFICULTY_TEXT: Record<Difficulty, string> = {
  1: "Difficulty 1: use a concrete everyday case, one variable, and give facts freely.",
  2: "Difficulty 2: use a familiar case and have them supply the example.",
  3: "Difficulty 3: use an unfamiliar case with two interacting factors; give facts on request.",
  4: "Difficulty 4: have them defend against their own best objection.",
};

const SCAFFOLD_TEXT =
  "They seem stuck. Give one concrete fact or a simpler case, then ask the same question again.";

const FLAG_TEXT: Record<TutorFlag, string> = {
  leading: "Your last question led them. Ask it again so they cannot answer with just yes.",
  lectured: "You spoke too long. Use at most three sentences, then hand the problem back.",
  offTopic: "Return to what they are working on.",
  ignoredStudent: "Refer to something specific they just said before asking anything new.",
};

const CARE_SLOW_TEXT =
  "The student may be upset. Slow down, ask something simple and concrete, say there is no rush, and offer a pause or to stop. Be kind.";
const CARE_CLOSE_TEXT =
  "Stop the interview questions now. Thank them kindly, say they can stop whenever they like, and close gently with no verdict.";

function wordCount(text: string): number {
  return text.split(/\s+/u).filter(Boolean).length;
}

function fits(text: string): boolean {
  return (
    wordCount(text) <= MAX_NOTE_WORDS && new TextEncoder().encode(text).length < MAX_NOTE_BYTES
  );
}

/**
 * Plain-language instruction for the live tutor, built from the note's `expect`.
 * At most 60 words and under 480 bytes: parts are added in priority order and any part that
 * would break either limit is left out.
 */
export function steeringText(note: SteeringNote): string {
  const e = note.expect ?? {};
  const parts: string[] = [];
  if (e.care === "close") parts.push(CARE_CLOSE_TEXT);
  else if (e.care === "slow") parts.push(CARE_SLOW_TEXT);
  else {
    // Most urgent first: one correction, then the phase, then difficulty or scaffold.
    const [firstFlag, ...moreFlags] = e.avoidFlags ?? [];
    if (firstFlag) parts.push(FLAG_TEXT[firstFlag]);
    if (e.phase) parts.push(PHASE_TEXT[e.phase]);
    if (e.move === "scaffold") parts.push(SCAFFOLD_TEXT);
    else if (e.difficulty) parts.push(DIFFICULTY_TEXT[e.difficulty]);
    // Further corrections only if there is room.
    for (const flag of moreFlags) parts.push(FLAG_TEXT[flag]);
  }
  let text = "";
  for (const part of parts) {
    const candidate = text ? `${text} ${part}` : part;
    if (fits(candidate)) text = candidate;
  }
  return text;
}

// ---------------------------------------------------------------------------------------------
// Monitoring.

/**
 * Did the tutor follow the last note? Compared against the first turn state analysed after the
 * note. For monitoring only: soft control means a "no" is data, not an error.
 */
export function complianceCheck(
  previousNote: SteeringNote,
  nextTurnState: TurnState,
): { complied: boolean; reason: string } {
  const e = previousNote.expect;
  if (!e) return { complied: true, reason: "note carried no checkable expectation" };
  if (nextTurnState.transcriptUnclear) {
    return { complied: true, reason: "turn unclear; not counted against the tutor" };
  }
  if (e.phase && nextTurnState.phase !== e.phase) {
    return { complied: false, reason: `asked for phase ${e.phase}, saw ${nextTurnState.phase}` };
  }
  if (e.difficulty && nextTurnState.difficulty !== e.difficulty) {
    return {
      complied: false,
      reason: `asked for difficulty ${e.difficulty}, saw ${nextTurnState.difficulty}`,
    };
  }
  if (e.move && nextTurnState.tutorMove !== e.move) {
    return { complied: false, reason: `asked for move ${e.move}, saw ${nextTurnState.tutorMove}` };
  }
  for (const flag of e.avoidFlags ?? []) {
    if (nextTurnState.tutorFlags[flag]) {
      return { complied: false, reason: `tutor flag ${flag} was raised again` };
    }
  }
  for (const move of e.avoidMoves ?? []) {
    if (nextTurnState.tutorMove === move) {
      return { complied: false, reason: `tutor used ${move} after a care note` };
    }
  }
  return { complied: true, reason: "next turn matches the note" };
}

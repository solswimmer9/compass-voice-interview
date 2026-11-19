// Runs the turn analyst and the phase director alongside a live interview.
// See docs/multi-subject-interview-architecture.md sections 6 and 7, and its migration plan:
// every interview runs in shadow mode (turn states are logged, nothing is sent to the tutor),
// and steering notes reach the live tutor only when `steer` is on (tester accounts first).
//
// No SDK import and no clock here: the relay supplies the model call, the elapsed time and the
// way a note is sent, so this can be tested without a network.
import type { Turn } from "@/lib/feedback/types";
import type { Criterion } from "@/lib/feedback/pipeline";
import { advance, complianceCheck, createDirector, type DirectorState } from "./director";
import { buildTurnAnalystPrompt, parseTurnStateResult } from "./turn-analyst";
import type { SteeringNote } from "./types";

/** An analyst call slower than this is abandoned; the director moves on time alone. */
export const ANALYST_TIMEOUT_MS = 15_000;

export type LiveDirectorOptions = {
  minutes: number;
  hasStimulus: boolean;
  criteria: Criterion[];
  cardIds?: string[];
  /** Send steering notes to the live tutor. Off means shadow mode: analyse and log only. */
  steer: boolean;
  /** One text-model call; must honour the abort signal. */
  analyse: (prompt: string, signal: AbortSignal) => Promise<string>;
  /** Delivers a steering note to the live tutor. */
  sendNote: (text: string) => void;
  /** Structured log line. Never given transcript text or user identifiers. */
  log: (entry: Record<string, unknown>) => void;
};

export type LiveDirector = {
  /** Call when a student turn has ended, with the turns so far, ending on that student turn. */
  studentTurnEnded(turns: Turn[], elapsedMs: number): void;
  close(): void;
  readonly state: DirectorState;
};

export function createLiveDirector(options: LiveDirectorOptions): LiveDirector {
  let state = createDirector({ minutes: options.minutes, hasStimulus: options.hasStimulus });
  const controller = new AbortController();
  let closed = false;
  let running = false;
  let queued: { turns: Turn[]; elapsedMs: number } | undefined;
  let analysedTurn = 0;
  let lastNote: SteeringNote | undefined;

  async function analyseTurn(turns: Turn[], elapsedMs: number) {
    const student = [...turns].reverse().find((turn) => turn.role === "user");
    if (!student || student.turn <= analysedTurn) return;
    analysedTurn = student.turn;
    const prompt = buildTurnAnalystPrompt({
      criteria: options.criteria,
      weakPatterns: [],
      recentTurns: turns,
      currentPhase: state.phase,
      difficulty: state.difficulty,
      ...(options.cardIds?.length ? { cardIds: options.cardIds } : {}),
    });
    let raw: string | undefined;
    let failure: string | undefined;
    const timeout = AbortSignal.timeout(ANALYST_TIMEOUT_MS);
    try {
      raw = await options.analyse(prompt, AbortSignal.any([controller.signal, timeout]));
    } catch (error) {
      failure = timeout.aborted ? "timeout" : error instanceof Error ? error.name : "error";
    }
    if (closed) return;
    const parsed =
      raw === undefined
        ? undefined
        : parseTurnStateResult(raw, {
            turn: student.turn,
            phase: state.phase,
            difficulty: state.difficulty,
          });
    // A failed or unusable analysis still lets time move the phase on.
    const turnState = parsed?.valid ? parsed.state : undefined;
    const compliance = lastNote && turnState ? complianceCheck(lastNote, turnState) : undefined;
    const result = advance(state, { elapsedMs, turnState });
    state = result.state;
    const note = result.note?.text ? result.note : undefined;
    if (note && options.steer) {
      options.sendNote(note.text);
      lastNote = note;
    }
    options.log({
      event: "interview.turn",
      turn: student.turn,
      analysed: Boolean(turnState),
      ...(failure ? { failure } : parsed && !parsed.valid ? { failure: "unparseable" } : {}),
      phase: state.phase,
      difficulty: state.difficulty,
      ...(turnState
        ? {
            tutorMove: turnState.tutorMove,
            tutorFlags: Object.entries(turnState.tutorFlags)
              .filter(([, raised]) => raised)
              .map(([flag]) => flag),
            handledChallenge: turnState.studentEvidence.handledChallenge,
          }
        : {}),
      ...(note ? { note: note.reason, noteSent: options.steer } : {}),
      ...(compliance ? { complied: compliance.complied } : {}),
    });
  }

  async function drain(turns: Turn[], elapsedMs: number) {
    running = true;
    try {
      await analyseTurn(turns, elapsedMs);
    } catch (error) {
      options.log({ event: "interview.turn", failure: "director", message: String(error) });
    } finally {
      running = false;
    }
    const next = queued;
    queued = undefined;
    if (next && !closed) void drain(next.turns, next.elapsedMs);
  }

  return {
    studentTurnEnded(turns, elapsedMs) {
      if (closed) return;
      // One analysis at a time; if the student finishes another turn meanwhile, only the
      // latest waiting one is analysed next.
      if (running) {
        queued = { turns: [...turns], elapsedMs };
        return;
      }
      void drain([...turns], elapsedMs);
    },
    close() {
      closed = true;
      queued = undefined;
      controller.abort();
    },
    get state() {
      return state;
    },
  };
}

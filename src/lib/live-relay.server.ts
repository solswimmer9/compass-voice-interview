import { createOpenAI } from "@ai-sdk/openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { streamText, type ModelMessage } from "ai";
import process from "node:process";
import type { Database } from "@/integrations/supabase/types";
import {
  DR_RIVER_BRIEFING,
  NOTES_CONTEXT,
  openingInstructions,
  readingOpeningInstructions,
  REASONING_GUIDE,
} from "./interview-briefing.ts";
import { groupTurns } from "./evals/metrics.ts";
import { readingById, READINGS } from "./readings.ts";
import { INTERVIEW_MINUTES } from "./limits.ts";
import { authenticateAccessToken } from "./request-auth.server.ts";
import { isServerTester } from "./testers.ts";

export type LiveConfig = {
  baseURL: string;
  key: string;
  liveModel: string;
  backendModel: string;
  /** Per session, set from app.start: the greeting and the selected practice reading. */
  openingInstructions?: string;
  readingId?: string | undefined;
};

const liveSettings = {
  baseURL: "https://ai.gateway.lovable.dev/v1",
  liveModel: "openai/gpt-live-1",
  backendModel: "openai/gpt-6-astra",
};

/** Silence after the student's last words before the backend is asked (or re-asked). */
export const STUDENT_PAUSE_MS = 800;
/** Minimum wait after a handoff, so trailing transcript can arrive first. */
export const HANDOFF_SETTLE_MS = 300;
/** Recent turns sent to the backend for a follow-up; feedback requests get the full transcript. */
export const BACKEND_HISTORY_TURNS = 12;
/** Given to the live model when the backend fails, so the student never hears about it. */
export const DELEGATION_FALLBACK =
  "Carry on in your own words as Dr River: pick out one assumption in what the student has just said and ask one short question about it.";

export type LiveSocket = {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onMessage(handler: (data: unknown) => void): void;
  onClose(handler: () => void): void;
  onError(handler: () => void): void;
};

export type LiveExecutionContext = { waitUntil(task: Promise<unknown>): void };
export type LiveConnector = (
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
) => Promise<LiveSocket>;

type WorkerSocket = WebSocket & { accept(): void };
declare const WebSocketPair: { new (): { 0: WorkerSocket; 1: WorkerSocket } };
type Transcript = {
  role: "user" | "assistant";
  text: string;
  start_ms: number;
  end_ms: number;
  listeningSound: boolean;
};
type ProviderEvent = {
  type: string;
  client_event_id?: string;
  error?: { client_event_id?: string; message?: string };
  session?: { id: string };
  delta?: string;
  start_ms?: number;
  end_ms?: number;
  offset_ms?: number;
  delegation?: { id: string; target: string };
};

export function getLiveConfig(): LiveConfig {
  const config: LiveConfig = {
    ...liveSettings,
    key: process.env["LOVABLE_API_KEY"] ?? "",
  };
  if ([config.baseURL, config.key, config.liveModel, config.backendModel].some((value) => !value)) {
    throw new Error("Missing Live relay configuration");
  }
  return config;
}

function gatewayAPIBase(baseURL: string) {
  return `${baseURL.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`;
}

async function gatewayRejection(response: Response) {
  const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.slice(0, 300) : "";
  return new Error(message || `Voice gateway rejected the connection (${response.status})`);
}

export function validateLiveUpgrade(
  request: Request,
  options: { allowMissingOrigin?: boolean } = {},
): Response | null {
  const origin = request.headers.get("origin");
  if (origin === null ? !options.allowMissingOrigin : origin !== new URL(request.url).origin) {
    return new Response("Voice connection origin rejected", { status: 403 });
  }
  if (request.method !== "GET" || request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("WebSocket required", { status: 426 });
  }
  return null;
}

function workerSocket(socket: WorkerSocket): LiveSocket {
  return {
    get readyState() {
      return socket.readyState;
    },
    send: (data) => socket.send(data),
    close: (code, reason) => socket.close(code, reason),
    onMessage: (handler) => socket.addEventListener("message", (event) => handler(event.data)),
    onClose: (handler) => socket.addEventListener("close", handler),
    onError: (handler) => socket.addEventListener("error", handler),
  };
}

export function handleLiveRequest(request: Request): Response {
  const waitUntil = (request as Request & Partial<LiveExecutionContext>).waitUntil;
  if (!waitUntil) return new Response("Live runtime unavailable", { status: 503 });
  const config = getLiveConfig();
  const rejected = validateLiveUpgrade(request);
  if (rejected) return rejected;
  const pair = new WebSocketPair();
  pair[1].accept();
  bindLiveConnection(workerSocket(pair[1]), config, { waitUntil }, async (url, headers, signal) => {
    const response = await fetch(url, { headers: { ...headers, Upgrade: "websocket" }, signal });
    const socket = (response as Response & { webSocket?: WorkerSocket | null }).webSocket;
    if (!socket) throw await gatewayRejection(response);
    socket.accept();
    return workerSocket(socket);
  });
  const response: ResponseInit & { webSocket: WebSocket } = { status: 101, webSocket: pair[0] };
  return new Response(null, response);
}

// Only the selected reading's summary and tutor thoughts go into the live prompt.
function readingsContext(readingId: string | undefined) {
  const reading = readingById(readingId);
  if (!reading) {
    return `PRACTICE READINGS
The app lists these articles for students to read: ${READINGS.map((r) => `"${r.title}" (${r.source})`).join("; ")}. Do not bring them up yourself. If the student says they have read one, ask them to sum up its argument in their own words, then test that reasoning. Never claim to have read it.`;
  }
  return `PRACTICE READING
This interview opens on "${reading.title}" (${reading.source}), which the student has just read. Spend the first 10 to 15 minutes on it, as some colleges do: check they understood it, then test its argument. Do not claim to have read the full article; work from what the student says and this summary: ${reading.context}
Questions: ${reading.questions.join(" ")}
Your own thoughts, to raise one at a time as challenges rather than lectures: ${reading.tutorThoughts.join(" ")}`;
}

/** The live model's session instructions for an interview, optionally on one practice reading. */
export function liveInstructions(readingId?: string) {
  return `${DR_RIVER_BRIEFING}

${NOTES_CONTEXT}

${readingsContext(readingId)}

Voice: calm, unhurried and soothing, like a gentle documentary narrator; speak slowly with natural pauses.
Mannerisms: Sound like a real British academic in a supervision, not a presenter. Open replies with varied natural bridges, for example "Right, but consider...", "Fair enough, though...", "Let's pause there for a second...", "Mm, interesting. So...", "Hang on, go back to...", "I wonder whether...". Never use the same bridge twice in a row, and sometimes use none.
Pause policy: Students think aloud and often pause mid-thought. Treat a short silence, a trailing "um", "so..." or an unfinished sentence as thinking, not the end of their turn: wait and stay quiet. Respond only once they have clearly finished a point. If they go quiet for a long while, gently say something brief like "Take your time" or "Think aloud if it helps", then wait again. Never fill silence with a new question or an answer.
Backchannel policy: Use moderate listening sounds such as "mm" while the candidate thinks, without taking over.
Interruption policy: Stop speaking and listen when the candidate interrupts.
Delegation policy:
Backend tools: A careful reasoning assistant that analyses the candidate's argument and suggests the sharpest follow-up challenge, or drafts the feedback described under CARE.
Delegate to the backend when: The candidate gives a long or complex argument and you need a precise counter-argument, or they ask for feedback.
Do not delegate to the backend when: Greeting, asking the opening question, short follow-ups, hints, or clarifications.
While you wait, stay quiet or use one brief natural holding phrase such as "Mm, let me think about that". Then say the result in your own words as Dr River. Never mention a backend, an assistant, a tool or a delay.`;
}

/** Backchannel and hesitation sounds ("mm-hm", "uh-huh", "um", "erm") that add no reasoning. */
export function isListeningSound(text: string) {
  const normalized = text.toLowerCase().replace(/[\s\p{P}]/gu, "");
  return /^(?:m+hm+|uhhuh|m+|h+m+|u+h+|u+m+|e+r+m*|a+h+)*$/.test(normalized);
}

function wantsFeedback(text: string) {
  return /\bfeedback\b|\bhow (?:did|am|have) i (?:do|did|doing|done)\b/i.test(text);
}

/**
 * The transcript as the backend sees it: deltas merged into one message per turn, fillers
 * dropped, and only the last `limit` turns, with a note that earlier discussion is omitted.
 */
export function backendTranscript(
  transcripts: readonly Pick<Transcript, "role" | "text" | "listeningSound">[],
  limit = BACKEND_HISTORY_TURNS,
): ModelMessage[] {
  const turns = groupTurns(
    transcripts
      .filter(({ listeningSound }) => !listeningSound)
      .map(({ role, text }) => ({ role, text, start_ms: 0, end_ms: 0 })),
  );
  const latestStudent = turns.filter(({ role }) => role === "user").at(-1);
  const kept = latestStudent && wantsFeedback(latestStudent.text) ? turns : turns.slice(-limit);
  const messages: ModelMessage[] = kept.map(({ role, text }) => ({ role, content: text }));
  if (kept.length < turns.length) {
    const note = `[Earlier discussion omitted: ${turns.length - kept.length} turns.]`;
    const first = messages[0];
    if (first?.role === "user")
      messages[0] = { role: "user", content: `${note}\n${first.content}` };
    else messages.unshift({ role: "user", content: note });
  }
  return messages;
}

async function answerQuestion(
  messages: ModelMessage[],
  config: LiveConfig,
  correlation: { runID: string; sessionID: string | undefined; delegationID: string },
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const provider = createOpenAI({
    baseURL: gatewayAPIBase(config.baseURL),
    apiKey: config.key,
    headers: {
      "Lovable-API-Key": config.key,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
  const result = streamText({
    model: provider.responses(config.backendModel),
    abortSignal: signal,
    maxRetries: 0,
    includeRawChunks: true,
    headers: {
      "X-Lovable-AIG-Run-ID": correlation.runID,
      "X-Lovable-AIG-Metadata": JSON.stringify({
        live_session_id: correlation.sessionID,
        delegation_id: correlation.delegationID,
      }),
    },
    providerOptions: {
      openai: {
        store: false,
        // Each call is one fresh, single-step request, so no reasoning state is carried over.
        ...(config.backendModel !== "openai/chat-latest"
          ? { forceReasoning: true, reasoningEffort: "medium" }
          : {}),
      },
    },
    system:
      "You support a spoken Cambridge geography admissions interviewer. Transcripts are speech recognition and may be incomplete or corrected; use the latest correction. " +
      "Identify the weakest assumption in the candidate's latest reasoning and return one sharp, interviewer-style follow-up challenge, " +
      "or, if feedback was requested, two strengths and two improvements. Do not give the model answer. At most 80 words, spoken style.\n\n" +
      REASONING_GUIDE,
    messages,
  });
  let completed = false;
  let stepCompleted = false;
  let failed = false;
  // Drain through HTTP EOF so successful work is not recorded as cancelled by the Gateway.
  for await (const part of result.fullStream) {
    if (part.type === "start-step") stepCompleted = false;
    if (
      part.type === "raw" &&
      part.rawValue &&
      typeof part.rawValue === "object" &&
      "type" in part.rawValue
    ) {
      if (part.rawValue.type === "response.completed") stepCompleted = true;
      if (part.rawValue.type === "response.failed" || part.rawValue.type === "response.incomplete")
        failed = true;
    }
    if (part.type === "finish-step" && !stepCompleted) failed = true;
    if (part.type === "error" || part.type === "abort") failed = true;
    if (part.type === "finish") completed = part.finishReason === "stop";
  }
  signal.throwIfAborted();
  if (failed || !completed) throw new Error("The backend response did not complete");
  const answer = await result.text;
  if (!answer.trim()) throw new Error("The backend response had no answer");
  return answer;
}

function* commentaryChunks(content: string) {
  const encoder = new TextEncoder();
  let chunk = "";
  let bytes = 0;
  for (const [word] of content.matchAll(/\S+\s*|\s+/gu)) {
    // Chunks stay well inside the provider's per-append size limit.
    if (chunk && bytes + encoder.encode(word).length > 480) {
      yield chunk;
      chunk = "";
      bytes = 0;
    }
    for (const character of word) {
      const size = encoder.encode(character).length;
      if (bytes + size > 480) {
        yield chunk;
        chunk = "";
        bytes = 0;
      }
      chunk += character;
      bytes += size;
    }
  }
  if (chunk) yield chunk;
}

export function bindLiveConnection(
  browser: LiveSocket,
  configuration: LiveConfig,
  execution: LiveExecutionContext,
  connect: LiveConnector,
): void {
  const config = { ...configuration };
  let durationTimer: ReturnType<typeof setTimeout> | undefined;
  const runID = crypto.randomUUID();
  const setupAbort = new AbortController();
  let gateway: LiveSocket | undefined;
  let sessionID: string | undefined;
  let starting = false;
  let closing = false;
  let finished = false;
  let revision = 0;
  let task: AbortController | undefined;
  const pendingDelegations: Array<{ event: ProviderEvent }> = [];
  let completedDelegation: (typeof pendingDelegations)[number] | undefined;
  let lastStudentSpeech = 0;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let finishDrain: (() => void) | undefined;
  let browserReady = false;
  let interviewCredit: { id: string; supabase: SupabaseClient<Database> } | undefined;
  let creditRelease: Promise<void> | undefined;
  let greetingRequested = false;
  let greetingCommand: { id: string; type: "instructions" | "commentary" } | undefined;
  let greetingTimer: ReturnType<typeof setTimeout> | undefined;
  const startTimer = setTimeout(() => {
    emit({ type: "app.error", error: { message: "Voice startup message timed out" } });
    stop();
  }, 5000);
  const transcripts: Transcript[] = [];
  const delegations = new Set<string>();

  function emit(event: object) {
    if (browser.readyState !== 1) return;
    try {
      browser.send(JSON.stringify(event));
    } catch {
      stop();
    }
  }

  function close(socket?: LiveSocket) {
    if (!socket || socket.readyState === 3) return;
    try {
      socket.close(1000, "Call ended");
    } catch {
      return;
    }
  }

  function clearGreeting() {
    clearTimeout(greetingTimer);
    greetingCommand = undefined;
  }

  function releaseUnusedCredit() {
    if (!interviewCredit || browserReady || creditRelease) return;
    const credit = interviewCredit;
    creditRelease = (async () => {
      const { error } = await credit.supabase.rpc("release_interview_credit", {
        p_interview_id: credit.id,
      });
      if (error) console.error("The unused interview credit could not be restored", error);
    })();
    execution.waitUntil(creditRelease);
  }

  async function authorizeStart(event: {
    accessToken?: unknown;
    environment?: unknown;
  }): Promise<string> {
    if (typeof event.accessToken !== "string" || !event.accessToken) {
      throw new Error("Please sign in again before starting your interview.");
    }
    const auth = await authenticateAccessToken(event.accessToken);
    if (!auth) throw new Error("Your sign-in has expired. Please sign in again.");
    // Unlimited testing is per signed-in tester account, never by web address.
    if (isServerTester(auth.user.email)) return "preview";
    if (event.environment !== "sandbox" && event.environment !== "live") {
      throw new Error("Your interview settings could not be checked.");
    }
    const { data: allowance, error } = await auth.supabase.rpc("consume_interview_credit", {
      p_environment: event.environment,
    });
    if (error) throw new Error("Your interview allowance could not be checked");
    const result = allowance as { allowed?: boolean; interviewId?: string } | null;
    if (!result?.allowed || !result.interviewId) {
      throw new Error(
        "Your free interview has been used. See the pricing page for more interviews or lifetime access.",
      );
    }
    interviewCredit = { id: result.interviewId, supabase: auth.supabase };
    return result.interviewId;
  }

  function requestGreeting() {
    const content = (
      config.openingInstructions ??
      "Start the conversation now in your configured language and role. Give a brief greeting suited to this app's purpose, ask one relevant opening question, then listen."
    ).trim();
    if (!content || !browserReady || !sessionID || greetingRequested || closing) return;
    greetingRequested = true;
    if (new TextEncoder().encode(content).length > 480) {
      emit({
        type: "app.greeting.error",
        error: { message: "The opening instructions are too long" },
      });
      return;
    }
    greetingCommand = { id: crypto.randomUUID(), type: "instructions" };
    greetingTimer = setTimeout(() => {
      clearGreeting();
      emit({
        type: "app.greeting.error",
        error: { message: "The opening could not be confirmed" },
      });
    }, 10_000);
    gateway?.send(
      JSON.stringify({
        type: "session.instructions.append",
        event_id: greetingCommand.id,
        delegation_id: null,
        content,
      }),
    );
  }

  function discardPendingWork() {
    pendingDelegations.length = 0;
    completedDelegation = undefined;
    clearTimeout(restartTimer);
    task?.abort();
  }

  function finish() {
    if (finished) return;
    releaseUnusedCredit();
    finished = closing = true;
    clearTimeout(durationTimer);
    clearTimeout(startTimer);
    clearTimeout(startupTimer);
    clearTimeout(closeTimer);
    clearTimeout(restartTimer);
    clearGreeting();
    discardPendingWork();
    setupAbort.abort();
    close(gateway);
    close(browser);
    finishDrain?.();
  }

  function stop() {
    if (closing) return;
    closing = true;
    releaseUnusedCredit();
    discardPendingWork();
    clearTimeout(durationTimer);
    clearTimeout(startupTimer);
    clearTimeout(startTimer);
    clearGreeting();
    if (gateway?.readyState === 1) {
      execution.waitUntil(
        new Promise<void>((resolve) => {
          finishDrain = resolve;
        }),
      );
      closeTimer = setTimeout(finish, 15_000);
      try {
        gateway.send(JSON.stringify({ type: "session.close" }));
      } catch {
        finish();
      }
    } else {
      finish();
    }
  }

  function scheduleDelegation() {
    clearTimeout(restartTimer);
    if (closing || task || pendingDelegations.length === 0) return;
    // Ask only once the student has paused, so one call covers their whole point.
    const wait = Math.max(HANDOFF_SETTLE_MS, lastStudentSpeech + STUDENT_PAUSE_MS - Date.now());
    restartTimer = setTimeout(() => void runDelegation(), wait);
  }

  function deliverResult(delegationID: string, answer: string) {
    if (closing) return;
    if (gateway?.readyState !== 1) return stop();
    try {
      for (const content of commentaryChunks(answer)) {
        gateway.send(
          JSON.stringify({
            type: "session.commentary.append",
            event_id: crypto.randomUUID(),
            delegation_id: delegationID,
            content,
          }),
        );
      }
      completedDelegation = pendingDelegations.shift();
    } catch {
      stop();
    }
  }

  async function runDelegation() {
    const pending = pendingDelegations[0];
    const event = pending?.event;
    const id = event?.delegation?.id;
    if (!pending || !event || !id || closing || task) return;
    // Rebuilt from the transcript each time: merged turns, recent history only.
    const messages = backendTranscript(transcripts);
    if (!messages.some(({ role }) => role === "user")) return;
    const controller = new AbortController();
    task = controller;
    const taskRevision = revision;
    try {
      let answer: string;
      try {
        answer = (
          await answerQuestion(
            messages,
            config,
            { runID, sessionID, delegationID: id },
            controller.signal,
          )
        ).trim();
      } catch (error) {
        if (!controller.signal.aborted) console.error("Delegated follow-up failed", error);
        answer = DELEGATION_FALLBACK;
      }
      // A result is stale once the student has said more; it is re-asked after their next pause.
      if (closing || controller.signal.aborted || taskRevision !== revision) return;
      deliverResult(id, answer);
    } finally {
      if (task === controller) task = undefined;
      scheduleDelegation();
    }
  }

  function queueDelegation(event: ProviderEvent) {
    pendingDelegations.push({ event });
    emit({ type: "app.delegation.pending", delegation_id: event.delegation?.id });
    scheduleDelegation();
  }

  function receiveGateway(data: unknown) {
    try {
      if (typeof data !== "string" || data.length > 1024 * 1024)
        throw new Error("Invalid voice event");
      const event: ProviderEvent = JSON.parse(data);
      if (browser.readyState === 1) browser.send(data);
      if (event.type === "session.closed") return finish();
      if (
        event.type === "gateway.session.closing" ||
        event.type === "gateway.error" ||
        event.type === "app.error"
      ) {
        return stop();
      }
      if (closing) return;
      if (event.type === "gateway.session.created") {
        sessionID = event.session?.id;
        clearTimeout(startupTimer);
        durationTimer ??= setTimeout(() => {
          emit({
            type: "app.error",
            error: {
              message: `Interviews are limited to ${INTERVIEW_MINUTES} minutes. Your transcript is below.`,
            },
          });
          stop();
        }, INTERVIEW_MINUTES * 60_000);
        requestGreeting();
      }
      if (
        greetingCommand &&
        event.type === `session.${greetingCommand.type}.appended` &&
        event.client_event_id === greetingCommand.id
      ) {
        if (greetingCommand.type === "instructions") {
          greetingCommand = { id: crypto.randomUUID(), type: "commentary" };
          gateway?.send(
            JSON.stringify({
              type: "session.commentary.append",
              event_id: greetingCommand.id,
              delegation_id: null,
              content: "Begin the conversation now, following the instructions provided.",
            }),
          );
        } else {
          clearGreeting();
          emit({ type: "app.greeting.accepted" });
        }
      } else if (
        greetingCommand &&
        event.type === "error" &&
        event.error?.client_event_id === greetingCommand.id
      ) {
        clearGreeting();
        emit({
          type: "app.greeting.error",
          error: { message: event.error.message ?? "The opening was rejected" },
        });
      }
      if (
        event.type === "session.input_transcript.delta" ||
        event.type === "session.output_transcript.delta"
      ) {
        const role = event.type === "session.input_transcript.delta" ? "user" : "assistant";
        if (!event.delta?.trim()) return;
        const listeningSound = role === "user" && isListeningSound(event.delta);
        transcripts.push({
          role,
          text: event.delta,
          start_ms: event.start_ms ?? 0,
          end_ms: event.end_ms ?? 0,
          listeningSound,
        });
        if (role === "user") lastStudentSpeech = Date.now();
        // A filler only postpones a waiting run; it never discards one in flight.
        if (listeningSound) return scheduleDelegation();
        if (role === "user") {
          revision++;
          task?.abort();
          const offset = completedDelegation?.event.offset_ms;
          // Live has no transcript watermark; completed handoffs can receive late context.
          if (
            pendingDelegations.length === 0 &&
            completedDelegation &&
            typeof offset === "number" &&
            Number.isFinite(offset) &&
            offset >= 0 &&
            typeof event.start_ms === "number" &&
            Number.isFinite(event.start_ms) &&
            event.start_ms >= 0 &&
            event.start_ms <= offset
          ) {
            pendingDelegations.push(completedDelegation);
            completedDelegation = undefined;
          }
          if (pendingDelegations.length) {
            emit({
              type: "app.delegation.pending",
              delegation_id: pendingDelegations[0]?.event.delegation?.id,
            });
          }
        }
        if (role === "user") scheduleDelegation();
      } else if (event.type === "session.delegation.created") {
        const id = event.delegation?.id;
        if (id && event.delegation?.target === "client" && !delegations.has(id)) {
          delegations.add(id);
          queueDelegation(event);
        }
      }
    } catch {
      emit({ type: "app.error", error: { message: "Invalid voice event or lost connection" } });
      stop();
    }
  }

  async function startSession(sdp: string) {
    if (closing || browser.readyState !== 1) return;
    clearTimeout(startTimer);
    startupTimer = setTimeout(() => {
      emit({ type: "app.error", error: { message: "Voice startup timed out" } });
      stop();
    }, 40_000);
    const accepted = await connect(
      new URL(`${gatewayAPIBase(config.baseURL)}/live/sessions`).href,
      {
        "Lovable-API-Key": config.key,
        "X-Lovable-AIG-SDK": "fetch",
        "X-Lovable-AIG-Run-ID": runID,
      },
      setupAbort.signal,
    );
    if (closing || browser.readyState !== 1) {
      close(accepted);
      return;
    }
    gateway = accepted;
    gateway.onMessage(receiveGateway);
    gateway.onClose(finish);
    gateway.onError(() => {
      emit({ type: "app.error", error: { message: "Voice gateway connection failed" } });
      stop();
    });
    gateway.send(
      JSON.stringify({
        type: "session.start",
        session: {
          model: config.liveModel,
          instructions: liveInstructions(config.readingId),
          audio: { output: { voice: "vesper" } },
          delegation: { type: "client" },
        },
        transport: { type: "webrtc", sdp },
      }),
    );
  }

  browser.onMessage((data) => {
    try {
      if (typeof data !== "string" || data.length > 64 * 1024)
        throw new Error("Invalid client message");
      const event = JSON.parse(data);
      if (event.type === "session.close") return stop();
      if (closing) return;
      if (!gateway) {
        if (
          starting ||
          event.type !== "app.start" ||
          typeof event.sdp !== "string" ||
          !event.sdp.trim()
        ) {
          throw new Error("Voice startup message required");
        }
        starting = true;
        const reading = readingById(event.readingId);
        config.readingId = reading?.id;
        config.openingInstructions = reading
          ? readingOpeningInstructions(reading)
          : openingInstructions(event.openingTurn);
        execution.waitUntil(
          (async () => {
            const interviewId = await authorizeStart(event);
            if (closing) return;
            emit({ type: "app.interview.started", interviewId });
            await startSession(event.sdp);
          })().catch((error) => {
            if (!closing)
              emit({
                type: "app.error",
                error: { message: error instanceof Error ? error.message : "Voice startup failed" },
              });
            stop();
          }),
        );
        return;
      }
      if (event.type === "app.ready") {
        browserReady = true;
        requestGreeting();
        return;
      }
      if (event.type !== "gateway.heartbeat") {
        throw new Error("Unsupported client event");
      }
      if (gateway.readyState !== 1) return stop();
      gateway.send(data);
    } catch {
      emit({
        type: "app.error",
        error: { message: "Voice connection could not be started or continued" },
      });
      stop();
    }
  });
  browser.onClose(stop);
  browser.onError(stop);
}

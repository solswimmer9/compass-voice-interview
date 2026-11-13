import { createOpenAI } from "@ai-sdk/openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stepCountIs, streamText, type ModelMessage } from "ai";
import process from "node:process";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  DR_RIVER_BRIEFING,
  NOTES_CONTEXT,
  openingInstructions,
  readingOpeningInstructions,
  REASONING_GUIDE,
} from "./interview-briefing.ts";
import { readingById, readingsFor } from "./readings.ts";
import { INTERVIEW_MINUTES, OBJECT_REVEAL_MINUTES } from "./limits.ts";
import { authenticateAccessToken } from "./request-auth.server.ts";
import { isServerTester } from "./testers.ts";
import { buildPpeSession, isPpeRequest, PPE_TUTOR_ID } from "./ppe.server.ts";
import {
  buildGeographySession,
  GEOGRAPHY_SUBJECT,
  GEOGRAPHY_TUTOR_ID,
} from "./geography.server.ts";
import {
  objectFeedbackContext,
  objectForBrowser,
  objectLiveSection,
  objectMidwaySection,
  OBJECT_REVEAL_INSTRUCTION,
  objectOpening,
  selectObject,
} from "../content/objects/index.ts";
import { tutorById } from "../content/index.ts";
import type { InterviewObject, TutorId } from "../content/types.ts";

export type LiveConfig = {
  baseURL: string;
  key: string;
  liveModel: string;
  backendModel: string;
  openingInstructions?: string;
};

// Fill from co-loaded knowledge: the gateway URL, the Live model and the resolved chat model.
const liveSettings = {
  baseURL: "https://ai.gateway.lovable.dev/v1",
  liveModel: "openai/gpt-live-1",
  backendModel: "openai/gpt-6-astra",
  openingInstructions:
    "Start now in British English. Briefly introduce yourself as Dr River, running a practice geography interview, then ask one warm, easy question about what draws the student to geography or what they notice about where they live, and listen.",
};

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

const readingsContext = `PRACTICE READINGS
The app lists these articles for students to read before an interview. When the interview opens on one of these readings, or the student says they have read one, spend the first 10 to 15 minutes on it, as some colleges do: check they understood it, then test its argument. Do not claim to have read the full article; work from what the student says and this summary. In a reading interview, raise your own thoughts on that article one at a time, as challenges rather than lectures. In any other interview, do not bring up these readings or thoughts unless the student does.
${readingsFor("geography")
  .map(
    (r) =>
      `- "${r.title}" (${r.source}): ${r.context} Questions: ${r.questions.join(" ")} Your own thoughts (only in an interview on this reading): ${r.tutorThoughts.join(" ")}`,
  )
  .join("\n")}`;

const conversationInstructions = `${DR_RIVER_BRIEFING}

${NOTES_CONTEXT}

${readingsContext}

Voice: calm, unhurried and soothing, like a gentle documentary narrator; speak slowly with natural pauses.
Mannerisms: Sound like a real British academic in a supervision, not a presenter. Keep most turns to one or two short sentences. Open replies with varied natural bridges, for example "Right, but consider...", "Fair enough, though...", "Let's pause there for a second...", "Hang on, go back to...", "I wonder whether...". Never use the same bridge twice in a row, and sometimes use none.
Pause policy: Students think aloud and often pause mid-thought. Treat a short silence, a trailing "um", "so..." or an unfinished sentence as thinking, not the end of their turn: wait and stay quiet. Respond only once they have clearly finished a point. If they go quiet for a long while, gently say something brief like "Take your time" or "Think aloud if it helps", then wait again. Never fill silence with a new question or an answer.
No-filler rule: Never use vocalised fillers or stall phrases such as "hmmm", "let me think", "let me see", "give me a second", "um", "er" or "so...". Never narrate that you are thinking or deciding what to say. If you need a moment, stay silent rather than filling it with a sound.
Interruption policy: Stop speaking and listen when the candidate interrupts.
Delegation policy:
Backend tools: A careful reasoning assistant that analyses the candidate's argument and suggests the sharpest follow-up challenge.
Delegate to the backend when: The candidate gives a long or complex argument and you need a precise counter-argument, or they ask for detailed feedback on the interview.
Do not delegate to the backend when: Greeting, asking the opening question, short follow-ups, hints, or clarifications. Wait for the backend result before presenting it.`;

const studyScheduleInput = z
  .object({
    total_minutes: z.number().int().min(1).max(10_080),
    days: z.number().int().min(1).max(30),
  })
  .strict();

function planStudySchedule(args: z.infer<typeof studyScheduleInput>) {
  const daily = Math.floor(args.total_minutes / args.days);
  return {
    total_minutes: args.total_minutes,
    days: args.days,
    sessions: Array.from({ length: args.days }, (_, index) => ({
      day: index + 1,
      minutes: daily + (index < args.total_minutes % args.days ? 1 : 0),
    })),
  };
}

function isListeningSound(text: string) {
  const normalized = text.toLowerCase().replace(/[\s\p{Pd}]/gu, "");
  return /^(?:m+hm+|uhhuh)[.,!]*$/.test(normalized);
}

/** What the backend model is told about the interview. Geography keeps today's fixed wording. */
type BackendBrief = { subject: string; guide: string };
const GEOGRAPHY_BRIEF: BackendBrief = { subject: GEOGRAPHY_SUBJECT, guide: REASONING_GUIDE };

async function answerQuestion(
  messages: ModelMessage[],
  config: LiveConfig,
  brief: BackendBrief,
  correlation: { runID: string; sessionID: string | undefined; delegationID: string },
  signal: AbortSignal,
  consumeInput: () => void,
  onPlan: (plan: ReturnType<typeof planStudySchedule>) => void,
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
  let responseCursor = 0;
  consumeInput();
  const result = streamText({
    model: provider.responses(config.backendModel),
    abortSignal: signal,
    maxRetries: 0,
    stopWhen: stepCountIs(50),
    includeRawChunks: true,
    prepareStep() {
      consumeInput();
      return { messages: [...messages] };
    },
    onStepFinish(step) {
      messages.push(...step.response.messages.slice(responseCursor));
      responseCursor = step.response.messages.length;
    },
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
        ...(config.backendModel !== "openai/chat-latest"
          ? {
              forceReasoning: true,
              reasoningEffort: "medium",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            }
          : {}),
      },
    },
    system:
      `You support a spoken ${brief.subject} admissions interviewer. Transcripts may be incomplete or corrected; use the latest correction. ` +
      "Identify the weakest assumption in the candidate's latest reasoning and return one sharp, interviewer-style follow-up challenge, " +
      "or, if feedback was requested, two strengths and two improvements. Do not give the model answer. At most 80 words, spoken style. You have no tools.\n\n" +
      brief.guide,
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
  /** A normal interview's chart, brought out partway through by revealTimer. */
  let midwayObject: InterviewObject | undefined;
  let revealTimer: ReturnType<typeof setTimeout> | undefined;
  const runID = crypto.randomUUID();
  const setupAbort = new AbortController();
  let gateway: LiveSocket | undefined;
  let sessionID: string | undefined;
  let starting = false;
  let closing = false;
  let finished = false;
  let revision = 0;
  let task: AbortController | undefined;
  const pendingDelegations: Array<{
    event: ProviderEvent;
    plan?: ReturnType<typeof planStudySchedule>;
  }> = [];
  let completedDelegation: (typeof pendingDelegations)[number] | undefined;
  const backendMessages: ModelMessage[] = [];
  let transcriptCursor = 0;
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
  let brief = GEOGRAPHY_BRIEF;
  let instructions = conversationInstructions;
  let voice = "vesper";
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

  /**
   * Signs the student in and consumes one interview credit (none for testers). `beforeCredit`
   * runs after sign-in and before any credit is taken, so work that can fail, such as building a
   * PPE interview, never costs a credit.
   */
  async function authorizeStart(
    event: {
      accessToken?: unknown;
      environment?: unknown;
    },
    beforeCredit?: (tester: boolean) => Promise<void>,
  ): Promise<string> {
    if (typeof event.accessToken !== "string" || !event.accessToken) {
      throw new Error("Please sign in again before starting your interview.");
    }
    const auth = await authenticateAccessToken(event.accessToken);
    if (!auth) throw new Error("Your sign-in has expired. Please sign in again.");
    // Unlimited testing is per signed-in tester account, never by web address.
    const tester = isServerTester(auth.user.email);
    await beforeCredit?.(tester);
    if (tester) return "preview";
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

  /**
   * Object interviews. Students get approved objects only; testers may also get drafts. Call
   * inside authorizeStart's beforeCredit callback, so a missing object never costs a credit.
   */
  function pickObject(tutorId: TutorId, tester: boolean, seed: unknown): InterviewObject {
    const object = selectObject(tutorId, {
      includeDrafts: tester,
      ...(typeof seed === "number" ? { seed } : {}),
    });
    if (!object) {
      throw new Error(
        "There is no object interview for this tutor yet. Please start a normal interview instead.",
      );
    }
    return object;
  }

  /**
   * Puts the object on the table: tutor-only notes go to the voice and backend models; the
   * browser gets only the picture, its neutral description and a caption.
   */
  function applyObject(object: InterviewObject, baseInstructions: string) {
    config.openingInstructions = objectOpening(object);
    instructions = `${baseInstructions}\n\n${objectLiveSection(object)}`;
    brief = { ...brief, guide: `${brief.guide}\n\n${objectFeedbackContext(object)}` };
    const name = tutorById(object.tutor)?.persona.name ?? "Your tutor";
    emit(objectForBrowser(object, `${name} has put this on the table`));
  }

  /**
   * Normal interviews: plans the tutor's chart for partway through. Students get approved
   * objects only; testers may also get drafts. Having no object is fine: the interview simply
   * has no chart. Call inside authorizeStart's beforeCredit callback.
   */
  function planMidwayObject(tutorId: TutorId, tester: boolean, seed: unknown) {
    midwayObject = selectObject(tutorId, {
      includeDrafts: tester,
      ...(typeof seed === "number" ? { seed } : {}),
    });
  }

  /** Adds the chart notes to the tutor's instructions, before the voice session starts. */
  function applyMidwayObject(baseInstructions: string) {
    if (!midwayObject) return;
    instructions = `${baseInstructions}\n\n${objectMidwaySection(midwayObject)}`;
  }

  /** Brings the chart out: the tutor is told, and the browser gets only the picture. */
  function revealMidwayObject() {
    const object = midwayObject;
    if (!object || closing || gateway?.readyState !== 1) return;
    midwayObject = undefined;
    try {
      gateway.send(
        JSON.stringify({
          type: "session.instructions.append",
          event_id: crypto.randomUUID(),
          delegation_id: null,
          content: OBJECT_REVEAL_INSTRUCTION,
        }),
      );
    } catch {
      return stop();
    }
    brief = { ...brief, guide: `${brief.guide}\n\n${objectFeedbackContext(object)}` };
    const name = tutorById(object.tutor)?.persona.name ?? "Your tutor";
    emit(objectForBrowser(object, `${name} has put this on the table`));
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
    clearTimeout(revealTimer);
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
    clearTimeout(revealTimer);
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
    restartTimer = setTimeout(() => void runDelegation(), 300);
  }

  function deliverResult(
    delegationID: string,
    answer: string,
    plan?: ReturnType<typeof planStudySchedule>,
  ) {
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
      if (plan) emit({ type: "app.study_schedule.plan", delegation_id: delegationID, plan });
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
    if (!transcripts.some(({ role, text }) => role === "user" && text.trim())) return;
    const controller = new AbortController();
    task = controller;
    let taskRevision = revision;
    try {
      const answer = await answerQuestion(
        backendMessages,
        config,
        brief,
        { runID, sessionID, delegationID: id },
        controller.signal,
        () => {
          const updates = transcripts.slice(transcriptCursor);
          if (updates.some(({ role, listeningSound }) => role === "user" && !listeningSound))
            delete pending.plan;
          backendMessages.push(...updates.map(({ role, text }) => ({ role, content: text })));
          transcriptCursor = transcripts.length;
          taskRevision = revision;
        },
        (plan) => {
          pending.plan = plan;
        },
      );
      if (closing || controller.signal.aborted) return;
      if (taskRevision !== revision) return;
      deliverResult(id, answer.trim(), pending.plan);
    } catch {
      if (closing || controller.signal.aborted) return;
      backendMessages.push({
        role: "assistant",
        content:
          "The backend attempt failed. Completed tool results remain valid; verify uncertain external actions before any retry.",
      });
      if (taskRevision !== revision) return;
      deliverResult(
        id,
        "The backend could not finish the answer. Ask whether the user wants to try again.",
      );
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
        if (midwayObject) {
          revealTimer ??= setTimeout(revealMidwayObject, OBJECT_REVEAL_MINUTES * 60_000);
        }
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
        const listeningSound = role === "user" && Boolean(task) && isListeningSound(event.delta);
        transcripts.push({
          role,
          text: event.delta,
          start_ms: event.start_ms ?? 0,
          end_ms: event.end_ms ?? 0,
          listeningSound,
        });
        if (listeningSound) return;
        if (role === "user") {
          revision++;
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
        scheduleDelegation();
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
          instructions,
          audio: { output: { voice } },
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
        if (event.mode !== undefined && event.mode !== "object") {
          throw new Error("Unknown interview mode");
        }
        const objectMode = event.mode === "object";
        if (event.tutorId !== undefined && event.tutorId !== "geography") {
          if (!isPpeRequest(event.tutorId)) {
            throw new Error("Unknown tutor");
          }
          execution.waitUntil(
            (async () => {
              let session: Awaited<ReturnType<typeof buildPpeSession>> | undefined;
              let object: InterviewObject | undefined;
              // Built after sign-in and before the credit: drafts for testers, approved cards
              // and objects only for everyone else, and a build failure never costs a credit.
              const interviewId = await authorizeStart(event, async (tester) => {
                session = await buildPpeSession(event, { includeDrafts: tester });
                if (objectMode) object = pickObject(PPE_TUTOR_ID, tester, event.openingTurn);
                else planMidwayObject(PPE_TUTOR_ID, tester, event.openingTurn);
              });
              if (closing || !session) return;
              config.openingInstructions = session.opening;
              instructions = session.liveInstructions;
              voice = "stone";
              brief = { subject: "Oxford-style PPE", guide: session.backendContext };
              const { tutorVersion, pedagogyVersion, cardIds, promptHash } = session;
              // Versions only; never transcript text or user identifiers.
              console.log(
                JSON.stringify({
                  event: "interview.session",
                  tutorId: PPE_TUTOR_ID,
                  tutorVersion,
                  pedagogyVersion,
                  cardIds,
                  promptHash,
                  ...(object ? { objectId: object.id } : {}),
                }),
              );
              emit({
                type: "app.interview.started",
                interviewId,
                tutorId: PPE_TUTOR_ID,
                cardIds,
                ...(object ? { objectId: object.id } : {}),
              });
              if (object) applyObject(object, session.liveInstructions);
              else applyMidwayObject(session.liveInstructions);
              await startSession(event.sdp);
            })().catch((error) => {
              if (!closing)
                emit({
                  type: "app.error",
                  error: {
                    message: error instanceof Error ? error.message : "Voice startup failed",
                  },
                });
              stop();
            }),
          );
          return;
        }
        const reading = readingById(event.readingId, "geography");
        config.openingInstructions = reading
          ? readingOpeningInstructions(reading)
          : openingInstructions(event.openingTurn);
        execution.waitUntil(
          (async () => {
            let object: InterviewObject | undefined;
            let cardSession: Awaited<ReturnType<typeof buildGeographySession>> | undefined;
            // Decided after sign-in, by tester account only (never hostname or environment).
            // Testers hear Dr River on approved topic cards so it can be voice-tested; everyone
            // else keeps the fixed prompt above. Built before any credit, like PPE. An object
            // interview's object is chosen here too, so a refusal never costs a credit.
            const interviewId = await authorizeStart(event, async (tester) => {
              if (objectMode) object = pickObject("geography", tester, event.openingTurn);
              // A reading fills the first part of the interview, so it gets no chart.
              else if (!reading) planMidwayObject("geography", tester, event.openingTurn);
              if (tester) cardSession = await buildGeographySession(event);
            });
            if (closing) return;
            if (cardSession) {
              config.openingInstructions = cardSession.opening;
              instructions = cardSession.liveInstructions;
              brief = { subject: GEOGRAPHY_SUBJECT, guide: cardSession.backendContext };
              const { tutorVersion, pedagogyVersion, cardIds, promptHash } = cardSession;
              // Versions only; never transcript text or user identifiers.
              console.log(
                JSON.stringify({
                  event: "interview.session",
                  tutorId: GEOGRAPHY_TUTOR_ID,
                  tutorVersion,
                  pedagogyVersion,
                  cardIds,
                  promptHash,
                  readingId: cardSession.readingId ?? null,
                }),
              );
            }
            emit({
              type: "app.interview.started",
              interviewId,
              ...(object ? { objectId: object.id } : {}),
            });
            if (object) applyObject(object, instructions);
            else applyMidwayObject(instructions);
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

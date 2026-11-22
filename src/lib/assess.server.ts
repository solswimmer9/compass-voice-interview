import { createOpenAI } from "@ai-sdk/openai";
import { FEEDBACK_MODEL, VIDEO_FEEDBACK_MODEL } from "./models.ts";
import { generateText, streamText, type ModelMessage } from "ai";
import process from "node:process";
import { createLovableAiGatewayProvider } from "./ai/gateway-helpers.ts";
import { createLovableAiGatewayRunIdFetch } from "./ai/run-id.ts";
import { NOTES_CONTEXT, REASONING_GUIDE } from "./interview-briefing.ts";
import {
  limitMessage,
  takeFeedback,
  takeFeedbackRequest,
  visitorKey,
} from "./rate-limit.server.ts";
import { authenticateRequest } from "./request-auth.server.ts";
import { isServerTester } from "./testers.ts";
import { isPpeRequest, ppeFeedbackContext } from "./ppe.server.ts";
import { objectFeedbackContext, usableObjectById } from "../content/objects/index.ts";
import { ARGUMENT_MAP_INSTRUCTIONS } from "./feedback/argument-map.ts";
import {
  canUseGroundedFeedback,
  GROUNDED_TIMEOUT_MS,
  parseModelJson,
  runCheckedFeedback,
} from "./feedback/grounded.server.ts";
import { buildArgumentMapBlock } from "./feedback/argument-map.server.ts";
import type { FeedbackDeps } from "./feedback/pipeline.ts";
import { createMapAwareLimiter } from "./feedback/map-aware-limit.ts";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const TEXT_MODEL = FEEDBACK_MODEL;
const VIDEO_MODEL = VIDEO_FEEDBACK_MODEL;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
/** A 20 MB video is about 27 MB as text, plus room for a long transcript. */
export const MAX_REQUEST_BYTES = 28 * 1024 * 1024;
/** Video formats the video feedback model accepts. */
export const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime", "video/mpeg"]);

const SYSTEM = `You are an experienced Cambridge geography admissions tutor reviewing a practice interview.
Assess the candidate's reasoning, not their knowledge alone. Use British English and Markdown with these sections:
## Overall impression (2-3 sentences)
## Strengths in reasoning (2-3 bullets, quote the candidate where possible)
## Where the reasoning slipped (2-3 bullets: unexamined assumptions, missed scales, lack of evidence, not engaging with pushback)
## Targeted improvements (3 concrete, practicable actions for next time)
## Try this next (one follow-up question to practise)
If a video is provided, also briefly comment on delivery: pace, thinking aloud, composure and body language.
Be honest, specific and encouraging. Under 400 words.

${REASONING_GUIDE}

${NOTES_CONTEXT}
When judging the candidate, give most weight to how far they developed the ideas above in their own words.`;

// PPE feedback. Same headings so the panel reads the same. Draft cards' notes only for testers.
const ppeSystem = (
  cardIds: unknown,
  includeDrafts: boolean,
) => `You are an experienced Oxford PPE admissions tutor reviewing a practice interview.
Assess the candidate's reasoning, not their knowledge alone. Use British English and Markdown with these sections:
## Overall impression (2-3 sentences)
## Strengths in reasoning (2-3 bullets, quote the candidate where possible)
## Where the reasoning slipped (2-3 bullets: unstated premises, values asserted as facts, ignored second-round effects, shifting the meaning of a term, not engaging with pushback)
## Targeted improvements (3 concrete, practicable actions for next time)
## Try this next (one follow-up question to practise)
If a video is provided, also briefly comment on delivery: pace, thinking aloud, composure and body language.
Be honest, specific and encouraging. Under 400 words.

${ppeFeedbackContext(cardIds, { includeDrafts })}
When judging the candidate, give most weight to how far they developed the ideas above in their own words.`;

export async function handleAssess(request: Request) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return Response.json({ error: "AI is not configured" }, { status: 500 });

  // Unlimited testing is per signed-in tester account, never by web address.
  const auth = await authenticateRequest(request);
  const preview = isServerTester(auth?.user.email);
  let body: {
    transcript?: unknown;
    video?: unknown;
    videoType?: unknown;
    interviewId?: unknown;
    tutorId?: unknown;
    cardIds?: unknown;
    objectId?: unknown;
  };
  // Refuse oversized requests before reading them, not after.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES)
    return Response.json({ error: "Video must be under 20 MB" }, { status: 413 });
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const ppe = isPpeRequest(body.tutorId);

  if (!preview) {
    // A loose per-address flood guard, then the real limit per signed-in student.
    const flood = takeFeedbackRequest(visitorKey(request));
    const allowed =
      flood.ok && auth ? takeFeedback(`user:${auth.user.id ?? auth.user.email}`) : flood;
    if (!allowed.ok) {
      return Response.json(
        { error: limitMessage("feedback", allowed.retryAfterMinutes) },
        { status: 429 },
      );
    }
  }

  const transcript =
    typeof body.transcript === "string" ? body.transcript.trim().slice(0, 40_000) : "";
  const video = typeof body.video === "string" ? body.video : "";
  const videoType =
    typeof body.videoType === "string" && body.videoType
      ? body.videoType.toLowerCase()
      : "video/mp4";
  const interviewId = typeof body.interviewId === "string" ? body.interviewId : "";
  // Object interview notes: approved objects for everyone, drafts' notes for testers only.
  const object = usableObjectById(body.objectId, ppe ? "ppe" : "geography", {
    includeDrafts: preview,
  });
  const system = [
    ppe ? ppeSystem(body.cardIds, preview) : SYSTEM,
    object && objectFeedbackContext(object),
    // Last, so the reply always ends with the map block the panel splits off.
    ARGUMENT_MAP_INSTRUCTIONS,
  ]
    .filter(Boolean)
    .join("\n\n");
  if (!transcript && !video)
    return Response.json({ error: "Add a transcript or a video" }, { status: 400 });
  if (video && !VIDEO_TYPES.has(videoType))
    return Response.json(
      { error: "Please upload an MP4, WebM, MOV or MPEG video" },
      { status: 415 },
    );
  if (video && video.length * 0.75 > MAX_VIDEO_BYTES)
    return Response.json({ error: "Video must be under 20 MB" }, { status: 413 });
  if (!preview && !/^[0-9a-f-]{36}$/i.test(interviewId))
    return Response.json({ error: "A valid interview is required" }, { status: 400 });

  if (!preview) {
    if (!auth) return Response.json({ error: "Sign in to request feedback" }, { status: 401 });
    const { data: feedbackAvailable, error: allowanceError } = await auth.supabase.rpc(
      "consume_feedback",
      {
        p_interview_id: interviewId,
      },
    );
    if (allowanceError)
      return Response.json(
        { error: "Your feedback allowance could not be checked" },
        { status: 500 },
      );
    if (!feedbackAvailable)
      return Response.json(
        { error: "This interview’s feedback has already been used." },
        { status: 403 },
      );
  }

  // Single-call feedback: one streamed model call with the prompts above. Used for videos and
  // very short transcripts, and lazily if the evidence-checked feedback falls back.
  const startTodayFeedback = () => {
    const intro = transcript
      ? `Interview transcript:\n\n${transcript}`
      : "No transcript was provided; assess from the video.";
    const messages: ModelMessage[] = [
      {
        role: "user",
        content: video
          ? [
              { type: "text", text: intro },
              { type: "file", data: video, mediaType: videoType },
            ]
          : intro,
      },
    ];
    return video
      ? streamText({
          model: createLovableAiGatewayProvider(key, undefined, { baseURL: GATEWAY })(VIDEO_MODEL),
          system,
          messages,
          maxRetries: 0,
          abortSignal: request.signal,
        })
      : streamText({
          model: textModel(key),
          system,
          messages,
          maxRetries: 0,
          abortSignal: request.signal,
          providerOptions: reasoning("medium"),
        });
  };

  const headers = {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-cache, no-transform",
  };

  // The allowance was taken above, before the letter exists. If the letter then fails (model
  // error, timeout, or the student's connection drops before it finishes), give the feedback back
  // so the student can try again instead of losing it.
  const userId = auth?.user.id;
  const restore = () => (userId ? restoreFeedback(interviewId, userId) : Promise.resolve());

  // Every account: evidence-checked feedback, every quotation verified against the transcript.
  // All access rules above have already run and the feedback allowance is charged once, before
  // this point, so nothing here can charge twice. Testers may draw on draft notes; students only
  // on approved ones. Any failure falls back silently to the single-call feedback.
  if (canUseGroundedFeedback({ transcript, video, ppe })) {
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const pipelineAbort = new AbortController();
        const signal = AbortSignal.any([request.signal, pipelineAbort.signal]);
        const deps = gatewayFeedbackDeps(key, signal);
        // The checked letter has no argument map, so ask for it alongside, in parallel.
        const mapBlock = buildArgumentMapBlock(transcript, deps.generateText, GROUNDED_TIMEOUT_MS);
        const outcome = await runCheckedFeedback(
          {
            transcript,
            ppe,
            cardIds: body.cardIds,
            interviewId,
            includeDrafts: preview,
            ...(object ? { objectContext: objectFeedbackContext(object) } : {}),
          },
          deps,
          { abort: () => pipelineAbort.abort() },
        );
        console.info(
          "[assess] checked feedback",
          outcome.ok
            ? { grounded: true, truncated: outcome.truncated, tester: preview }
            : { grounded: false, reason: outcome.reason, tester: preview },
        );
        if (request.signal.aborted) {
          pipelineAbort.abort();
          await restore();
          return controller.close();
        }
        if (outcome.ok) {
          // Send the checked letter at once; the panel already accepts the map arriving after it.
          controller.enqueue(encoder.encode(outcome.text));
          const map = await withinGrace(mapBlock, MAP_GRACE_MS);
          // Stop a map call that is still running so it is not billed after the response ends.
          pipelineAbort.abort();
          if (map && !request.signal.aborted) controller.enqueue(encoder.encode(map));
          return controller.close();
        }
        // Falling back: the single-call reply brings its own map, so cancel the separate one.
        pipelineAbort.abort();
        let result: ReturnType<typeof startTodayFeedback>;
        try {
          result = startTodayFeedback();
        } catch {
          await restore();
          controller.enqueue(encoder.encode("\n\n[[error]]The assessment could not be completed."));
          return controller.close();
        }
        const delivered = await pipeFeedback(result, controller, request.signal);
        if (!delivered) await restore();
        controller.close();
      },
    });
    return new Response(stream, { headers });
  }

  let result: ReturnType<typeof startTodayFeedback>;
  try {
    result = startTodayFeedback();
  } catch (error) {
    await restore();
    throw error;
  }
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const delivered = await pipeFeedback(result, controller, request.signal);
      if (!delivered) await restore();
      controller.close();
    },
  });
  return new Response(stream, { headers });
}

/** Marks a student's interview as not yet having had feedback, after a letter failed. */
async function restoreFeedback(interviewId: string, userId: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("interview_sessions")
      .update({ feedback_used: false })
      .eq("id", interviewId)
      .eq("user_id", userId);
    if (error) throw error;
  } catch (error) {
    console.error("[assess] could not restore feedback after a failed letter", error);
  }
}

const encoder = new TextEncoder();

/** How long the argument map may still take once the checked letter has been sent. */
export const MAP_GRACE_MS = 10_000;

/** Resolves to the value, or "" if it takes longer than `ms`. Clears its timer either way. */
async function withinGrace(value: Promise<string>, ms: number): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      value,
      new Promise<string>((resolve) => {
        timer = setTimeout(() => resolve(""), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Streams a model reply to the browser within the word limit, with today's error messages.
 * Returns true only if a letter was sent in full: some text, no error, and not cut off.
 */
async function pipeFeedback(
  result: { fullStream: AsyncIterable<{ type: string; text?: string; error?: unknown }> },
  controller: ReadableStreamDefaultController<Uint8Array>,
  signal: AbortSignal,
): Promise<boolean> {
  let sentText = false;
  let failed = false;
  // The word limit covers the letter; a trailing argument-map block passes through intact.
  const limiter = createMapAwareLimiter();
  const send = (text: string) => {
    if (text) controller.enqueue(encoder.encode(text));
  };
  try {
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        if (part.text) sentText = true;
        send(limiter.push(part.text ?? ""));
        if (limiter.done) break; // Nothing more will be sent.
      }
      if (part.type === "error") {
        failed = true;
        send(limiter.end());
        const err = part.error as { statusCode?: number; message?: string };
        const message =
          err?.statusCode === 402
            ? "AI credits have run out. Add credits to your workspace to continue."
            : err?.statusCode === 429
              ? "Too many requests right now. Please try again in a minute."
              : "The assessment could not be completed.";
        controller.enqueue(encoder.encode(`\n\n[[error]]${message}`));
      }
    }
    send(limiter.end());
  } catch {
    failed = true;
    if (!signal.aborted) {
      send(limiter.end());
      controller.enqueue(encoder.encode("\n\n[[error]]The assessment could not be completed."));
    }
  }
  return sentText && !failed && !signal.aborted;
}

function textModel(key: string) {
  return createOpenAI({
    baseURL: GATEWAY,
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: createLovableAiGatewayRunIdFetch().fetch,
  }).responses(TEXT_MODEL);
}

function reasoning(reasoningEffort: "low" | "medium") {
  return {
    openai: {
      forceReasoning: true,
      reasoningEffort,
      reasoningSummary: "auto",
      store: false,
      include: ["reasoning.encrypted_content"],
    },
  };
}

/** The pipeline's two model calls, on the same gateway, model and server-only key as today. */
function gatewayFeedbackDeps(key: string, abortSignal: AbortSignal): FeedbackDeps {
  return {
    async generateJSON({ system, prompt }) {
      const { text } = await generateText({
        model: textModel(key),
        system,
        prompt,
        maxRetries: 0,
        abortSignal,
        providerOptions: reasoning("medium"),
      });
      return parseModelJson(text);
    },
    async generateText({ system, prompt }) {
      const { text } = await generateText({
        model: textModel(key),
        system,
        prompt,
        maxRetries: 0,
        abortSignal,
        providerOptions: reasoning("low"),
      });
      return text;
    },
  };
}

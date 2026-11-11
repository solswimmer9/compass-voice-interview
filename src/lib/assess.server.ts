import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";
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

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const TEXT_MODEL = "openai/gpt-6-astra";
const VIDEO_MODEL = "google/gemini-3.8-flash";
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

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

type ModelFailure = { status: number; message: string };

function describeFailure(error: unknown): ModelFailure {
  const statusCode = (error as { statusCode?: number } | null)?.statusCode;
  if (statusCode === 402)
    return {
      status: 503,
      message: "Feedback is unavailable right now because the AI service is out of credit.",
    };
  if (statusCode === 429)
    return { status: 429, message: "The feedback service is busy. Please try again in a minute." };
  return { status: 502, message: "The assessment could not be completed." };
}

let warnedReleaseMissing = false;

/**
 * Gives back an interview's feedback after generation failed, using the service-role-only
 * release_feedback database function. Until Lovable adds that function this does nothing and
 * returns false (see docs/lovable-db-request.md).
 */
export async function releaseFeedback(userId: string, interviewId: string): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // release_feedback is not in the generated types until the database change is made.
    const admin = supabaseAdmin as unknown as {
      rpc(
        fn: string,
        args: Record<string, unknown>,
      ): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
    };
    const { data, error } = await admin.rpc("release_feedback", {
      p_interview_id: interviewId,
      p_user_id: userId,
    });
    if (error) {
      // PGRST202: function not found. 42883: undefined function.
      if (error.code === "PGRST202" || error.code === "42883") {
        if (!warnedReleaseMissing) console.warn("release_feedback is not installed yet");
        warnedReleaseMissing = true;
      } else {
        console.error("The interview's feedback could not be restored", error);
      }
      return false;
    }
    return data === true;
  } catch (error) {
    console.error("The interview's feedback could not be restored", error);
    return false;
  }
}

function failureMessage(failure: ModelFailure, restored: boolean, charged: boolean) {
  if (!charged) return failure.message;
  return restored
    ? `${failure.message} This interview's feedback has not been used, so you can try again.`
    : `${failure.message} If this keeps happening, contact us and we will restore this interview's feedback.`;
}

type StreamPart = { type: string; text?: string; error?: unknown };

export async function handleAssess(request: Request) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return Response.json({ error: "AI is not configured" }, { status: 500 });

  // A loose per-address flood guard before any sign-in work; the real limit is per user below.
  const flood = takeFeedbackRequest(visitorKey(request));
  if (!flood.ok) {
    return Response.json(
      { error: limitMessage("feedback", flood.retryAfterMinutes) },
      { status: 429 },
    );
  }

  // Unlimited testing is per signed-in tester account, never by web address.
  const auth = await authenticateRequest(request);
  const preview = isServerTester(auth?.user.email);
  if (!preview && !auth)
    return Response.json({ error: "Sign in to request feedback" }, { status: 401 });

  let body: { transcript?: unknown; video?: unknown; videoType?: unknown; interviewId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const transcript =
    typeof body.transcript === "string" ? body.transcript.trim().slice(0, 40_000) : "";
  const video = typeof body.video === "string" ? body.video : "";
  const videoType =
    typeof body.videoType === "string" && body.videoType.startsWith("video/")
      ? body.videoType
      : "video/mp4";
  const interviewId = typeof body.interviewId === "string" ? body.interviewId : "";
  if (!transcript && !video)
    return Response.json({ error: "Add a transcript or a video" }, { status: 400 });
  if (video && video.length * 0.75 > MAX_VIDEO_BYTES)
    return Response.json({ error: "Video must be under 20 MB" }, { status: 413 });

  let charged = false;
  const userId = auth?.user.id;
  if (!preview && auth) {
    if (!/^[0-9a-f-]{36}$/i.test(interviewId))
      return Response.json({ error: "A valid interview is required" }, { status: 400 });
    const allowed = takeFeedback(`user:${userId ?? auth.user.email ?? visitorKey(request)}`);
    if (!allowed.ok) {
      return Response.json(
        { error: limitMessage("feedback", allowed.retryAfterMinutes) },
        { status: 429 },
      );
    }
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
    charged = true;
  }

  // Restores the feedback at most once, and only if it was taken from this user.
  let released: Promise<boolean> | undefined;
  const release = () => {
    if (!charged || !userId) return Promise.resolve(false);
    released ??= releaseFeedback(userId, interviewId);
    return released;
  };

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

  // Stops the model both when the browser disconnects and when the response stream is cancelled.
  const abort = new AbortController();
  if (request.signal.aborted) abort.abort();
  else request.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const aborted = () => abort.signal.aborted;

  let parts: AsyncIterator<StreamPart>;
  try {
    const result = video
      ? streamText({
          model: createLovableAiGatewayProvider(key, undefined, { baseURL: GATEWAY })(VIDEO_MODEL),
          system: SYSTEM,
          messages,
          maxRetries: 0,
          abortSignal: abort.signal,
        })
      : streamText({
          model: createOpenAI({
            baseURL: GATEWAY,
            apiKey: key,
            headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
            fetch: createLovableAiGatewayRunIdFetch().fetch,
          }).responses(TEXT_MODEL),
          system: SYSTEM,
          messages,
          maxRetries: 0,
          abortSignal: abort.signal,
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "medium",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });
    parts = (result.fullStream as AsyncIterable<StreamPart>)[Symbol.asyncIterator]();
  } catch (error) {
    const failure = describeFailure(error);
    const restored = await release();
    return Response.json(
      { error: failureMessage(failure, restored, charged) },
      { status: failure.status },
    );
  }

  // Wait for the first words before answering, so a failure that happens before any feedback
  // is written (no AI credit, rate limits, model errors) gets a clear error and the
  // interview's feedback is given back. No feedback has been seen yet, so this cannot be abused.
  let first: { text: string } | { done: true };
  try {
    first = await firstText(parts);
  } catch (error) {
    const restored = await release();
    if (aborted()) return new Response(null, { status: 499 });
    const failure = describeFailure(error);
    return Response.json(
      { error: failureMessage(failure, restored, charged) },
      { status: failure.status },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          abort.abort();
        }
      };
      try {
        if ("done" in first) {
          const restored = await release();
          send(
            `[[error]]${failureMessage({ status: 502, message: "The assessment came back empty." }, restored, charged)}`,
          );
          return;
        }
        send(first.text);
        for (;;) {
          const { value: part, done } = await parts.next();
          if (done || aborted()) break;
          if (part.type === "text-delta" && part.text) send(part.text);
          else if (part.type === "error") throw part.error;
          else if (part.type === "abort") break;
        }
      } catch (error) {
        // A browser that stopped reading has already seen part of the feedback, so it is not
        // given back. A server-side failure part-way through is.
        if (!aborted()) {
          const restored = await release();
          send(`\n\n[[error]]${failureMessage(describeFailure(error), restored, charged)}`);
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed or cancelled.
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
}

/** Reads parts until the first text arrives. Throws on an error, abort or failed iteration. */
async function firstText(
  parts: AsyncIterator<StreamPart>,
): Promise<{ text: string } | { done: true }> {
  for (;;) {
    const { value: part, done } = await parts.next();
    if (done) return { done: true };
    if (part.type === "text-delta" && part.text) return { text: part.text };
    if (part.type === "error") throw part.error;
    if (part.type === "abort") throw new Error("Assessment aborted");
  }
}

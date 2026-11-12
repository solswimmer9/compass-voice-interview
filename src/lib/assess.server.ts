import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";
import process from "node:process";
import { createLovableAiGatewayProvider } from "./ai/gateway-helpers.ts";
import { createLovableAiGatewayRunIdFetch } from "./ai/run-id.ts";
import { NOTES_CONTEXT, REASONING_GUIDE } from "./interview-briefing.ts";
import { limitMessage, takeFeedback, visitorKey } from "./rate-limit.server.ts";
import { authenticateRequest } from "./request-auth.server.ts";
import { isServerTester } from "./testers.ts";
import { isPpeRequest, ppeFeedbackContext } from "./ppe.server.ts";
import { objectFeedbackContext, usableObjectById } from "../content/objects/index.ts";

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
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const ppe = isPpeRequest(body.tutorId);

  if (!preview) {
    const allowed = takeFeedback(visitorKey(request));
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
    typeof body.videoType === "string" && body.videoType.startsWith("video/")
      ? body.videoType
      : "video/mp4";
  const interviewId = typeof body.interviewId === "string" ? body.interviewId : "";
  // Object interview notes: approved objects for everyone, drafts' notes for testers only.
  const object = usableObjectById(body.objectId, ppe ? "ppe" : "geography", {
    includeDrafts: preview,
  });
  const system = [
    ppe ? ppeSystem(body.cardIds, preview) : SYSTEM,
    object && objectFeedbackContext(object),
  ]
    .filter(Boolean)
    .join("\n\n");
  if (!transcript && !video)
    return Response.json({ error: "Add a transcript or a video" }, { status: 400 });
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

  const result = video
    ? streamText({
        model: createLovableAiGatewayProvider(key, undefined, { baseURL: GATEWAY })(VIDEO_MODEL),
        system,
        messages,
        maxRetries: 0,
        abortSignal: request.signal,
      })
    : streamText({
        model: createOpenAI({
          baseURL: GATEWAY,
          apiKey: key,
          headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: createLovableAiGatewayRunIdFetch().fetch,
        }).responses(TEXT_MODEL),
        system,
        messages,
        maxRetries: 0,
        abortSignal: request.signal,
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") controller.enqueue(encoder.encode(part.text));
          if (part.type === "error") {
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
      } catch {
        if (!request.signal.aborted)
          controller.enqueue(encoder.encode("\n\n[[error]]The assessment could not be completed."));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
}

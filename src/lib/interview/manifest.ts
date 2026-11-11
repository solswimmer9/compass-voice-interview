// Run manifest: what produced an interview, so two runs can be compared and the feedback
// pipeline re-run on a stored transcript. See architecture document section 11.
import type { SessionContext } from "@/content/types";
import type { RunManifest } from "./types";

/** Bump on any change to director.ts behaviour or steering text. */
export const DIRECTOR_VERSION = "1.0.0";

export function buildRunManifest(input: {
  interviewId: string;
  session: SessionContext;
  models: RunManifest["models"];
  directorVersion: string;
  feedbackPipelineVersion: string;
  now: Date;
  gatewayReported?: Record<string, string>;
}): RunManifest {
  const { session, models } = input;
  return {
    interviewId: input.interviewId,
    pedagogyVersion: session.pedagogyVersion,
    pack: { id: session.tutorId, version: session.tutorVersion },
    cardIds: [...session.cardIds],
    promptHash: session.promptHash,
    models: {
      live: models.live,
      analyst: models.analyst,
      feedback: models.feedback,
      ...(models.video ? { video: models.video } : {}),
    },
    ...(input.gatewayReported ? { gatewayReported: { ...input.gatewayReported } } : {}),
    directorVersion: input.directorVersion,
    feedbackPipelineVersion: input.feedbackPipelineVersion,
    createdAt: input.now.toISOString(),
    ...(session.readingId ? { stimulusId: session.readingId } : {}),
  };
}

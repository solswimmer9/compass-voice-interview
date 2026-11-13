import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArgumentMap } from "@/components/ArgumentMap";
import { FeedbackLetter } from "@/components/FeedbackLetter";
import {
  parseArgumentMap,
  splitFeedbackStream,
  tutorLetterInfo,
  type ArgumentMap as ArgumentMapData,
} from "@/lib/feedback/argument-map";
import {
  transcriptText,
  updateFinishedInterview,
  type FinishedInterview,
} from "@/lib/finished-interview";

/**
 * The tutor's feedback letter for a finished interview. It asks for feedback as soon as it
 * appears (once per interview; the server also allows only one) and keeps the finished letter
 * for this tab, so a refresh shows it again instead of asking twice.
 */
export function AssessPanel({
  interview,
  studentName,
}: {
  interview: FinishedInterview;
  /** The signed-in profile's display name, for the letter's greeting. */
  studentName?: string | null | undefined;
}) {
  const tutorId = interview.tutor === "ppe" ? ("ppe" as const) : undefined;
  const tutor = tutorLetterInfo(tutorId);
  const saved = interview.feedback ? splitFeedbackStream(interview.feedback) : null;
  const [output, setOutput] = useState(saved?.letter ?? "");
  const [argumentMap, setArgumentMap] = useState<ArgumentMapData | null>(
    saved && !saved.error ? parseArgumentMap(saved.mapSource) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requested = useRef(Boolean(interview.feedbackRequested || interview.feedback));

  const submit = async () => {
    requested.current = true;
    setError(null);
    setOutput("");
    setArgumentMap(null);
    setBusy(true);
    updateFinishedInterview(interview.interviewId, { feedbackRequested: true });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in to get your feedback.");
      const body: Record<string, string | string[]> = {
        transcript: transcriptText(interview),
        interviewId: interview.interviewId,
      };
      if (tutorId) {
        body["tutorId"] = tutorId;
        if (interview.cardIds?.length) body["cardIds"] = interview.cardIds;
      }
      if (interview.objectId) body["objectId"] = interview.objectId;
      const response = await fetch("/api/assess", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!response.ok || !response.body) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(result.error ?? "Your feedback could not be written. Please try again.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        // The argument map block (after the delimiter) never reaches the letter, even mid-stream.
        const { letter, error: streamError } = splitFeedbackStream(text);
        setOutput(letter);
        if (streamError) setError(streamError);
      }
      text += decoder.decode();
      const final = splitFeedbackStream(text);
      setOutput(final.letter);
      setArgumentMap(final.error ? null : parseArgumentMap(final.mapSource));
      if (!final.error && final.letter.trim()) {
        updateFinishedInterview(interview.interviewId, { feedback: text });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your feedback could not be written.");
    } finally {
      setBusy(false);
    }
  };

  // Ask once, as soon as the page opens. A refresh after asking shows "Try again" instead.
  useEffect(() => {
    if (requested.current || !interview.lines.length) return;
    void submit();
    // submit is recreated every render; this should only run when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interview.interviewId]);

  const waiting = !busy && !output.trim() && !error;

  return (
    <section>
      {busy && !output && (
        <p className="text-muted-foreground" aria-live="polite">
          {tutor.name} is reading back through your answers…
        </p>
      )}
      {error && (
        <div className="rounded-md border border-destructive/50 p-4">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          {!busy && (
            <button onClick={submit} className="mt-3 rounded-full border px-5 py-2 text-sm">
              Try again
            </button>
          )}
        </div>
      )}
      {waiting && requested.current && (
        <div className="rounded-md border p-4">
          <p className="text-sm text-muted-foreground">
            Your letter was being written when the page reloaded.
          </p>
          <button onClick={submit} className="mt-3 rounded-full border px-5 py-2 text-sm">
            Try again
          </button>
        </div>
      )}
      {(busy || output.trim()) && (
        <FeedbackLetter tutor={tutor} studentName={studentName} body={output} writing={busy} />
      )}
      {!busy && argumentMap && <ArgumentMap map={argumentMap} tutorName={tutor.name} />}
    </section>
  );
}

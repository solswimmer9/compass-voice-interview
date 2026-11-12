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

function readDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AssessPanel({
  initialTranscript,
  interviewId,
  tutorId,
  cardIds,
  objectId,
  studentName,
}: {
  initialTranscript: string;
  interviewId: string | null;
  /** Set for the PPE trial so feedback uses the PPE tutor's notes. */
  tutorId?: "ppe";
  cardIds?: string[];
  /** Set for an object interview so feedback can use that object's notes. */
  objectId?: string;
  /** The signed-in profile's display name, for the letter's greeting. */
  studentName?: string | null | undefined;
}) {
  const tutor = tutorLetterInfo(tutorId);
  const [transcript, setTranscript] = useState(initialTranscript);
  const [video, setVideo] = useState<File | null>(null);
  const [output, setOutput] = useState("");
  const [argumentMap, setArgumentMap] = useState<ArgumentMapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (initialTranscript) setTranscript(initialTranscript);
  }, [initialTranscript]);

  const submit = async () => {
    setError(null);
    setOutput("");
    setArgumentMap(null);
    if (!interviewId) return setError("Start an interview before requesting feedback.");
    if (video && video.size > 20 * 1024 * 1024) return setError("Video must be under 20 MB.");
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in to request feedback.");
      const body: Record<string, string | string[]> = { transcript, interviewId };
      if (tutorId) {
        body["tutorId"] = tutorId;
        if (cardIds?.length) body["cardIds"] = cardIds;
      }
      if (objectId) body["objectId"] = objectId;
      if (video) {
        body["video"] = await readDataURL(video);
        body["videoType"] = video.type || "video/mp4";
      }
      const response = await fetch("/api/assess", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(result.error ?? "Assessment failed");
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
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : "Assessment failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-12 rounded-md border bg-card p-4 sm:p-6">
      <h2 className="font-serif text-3xl font-semibold">Assess my reasoning</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Submit your replay, an optional video, or both. Each interview includes one AI feedback
        assessment.
      </p>
      <textarea
        value={transcript}
        onChange={(event) => setTranscript(event.target.value)}
        rows={6}
        placeholder={
          tutorId === "ppe"
            ? "Prof Matt: Is it ever fair to punish someone before they act?\nYou: ..."
            : "Dr River: Why do cities exist where they do?\nYou: ..."
        }
        className="mt-4 w-full rounded-md border bg-background p-3 text-sm"
      />
      <label className="mt-3 block text-sm">
        <span className="text-muted-foreground">Optional video (under 20 MB)</span>
        <input
          type="file"
          accept="video/*"
          onChange={(event) => setVideo(event.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2"
        />
      </label>
      <div className="mt-4 flex gap-3">
        <button
          onClick={submit}
          disabled={busy || !interviewId || (!transcript.trim() && !video)}
          className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground disabled:opacity-40"
        >
          {busy ? "Assessing…" : "Get feedback"}
        </button>
        {busy && (
          <button
            onClick={() => abortRef.current?.abort()}
            className="rounded-full border px-4 py-2 text-sm"
          >
            Stop
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {(busy || output.trim()) && (
        <FeedbackLetter tutor={tutor} studentName={studentName} body={output} writing={busy} />
      )}
      {!busy && argumentMap && <ArgumentMap map={argumentMap} tutorName={tutor.name} />}
    </section>
  );
}

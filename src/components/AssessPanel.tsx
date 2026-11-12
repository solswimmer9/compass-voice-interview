import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { splitFeedback } from "@/lib/feedback-sections";

function readDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AssessPanel({
  transcript,
  interviewId,
  tutorId,
  cardIds,
}: {
  transcript: string;
  interviewId: string | null;
  /** Set for PPE so feedback uses Prof Matt's notes. */
  tutorId?: "ppe";
  cardIds?: string[];
}) {
  const [video, setVideo] = useState<File | null>(null);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const submit = async () => {
    setError(null);
    setOutput("");
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
      if (video) {
        body["video"] = await readDataURL(video);
        body["videoType"] = video.type || "video/mp4";
      }
      const response = await fetch("/api/assess", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(result.error ?? "Feedback failed. Please try again.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        const [main, streamError] = text.split("[[error]]");
        setOutput(main ?? "");
        if (streamError) setError(streamError);
      }
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : "Feedback failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const sections = splitFeedback(output);
  const started = busy || output.length > 0;

  return (
    <section className="rounded-md border bg-card p-6 sm:p-8">
      <h2 className="text-2xl font-medium tracking-tight">Your feedback</h2>
      {!started && (
        <>
          <p className="mt-2 text-muted-foreground">
            We read your answers and show where your reasoning held and where it slipped. One
            feedback report per interview.
          </p>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Add a video of yourself (optional)
            </summary>
            <p className="mt-2 text-muted-foreground">
              Under 20 MB. Lets the feedback comment on delivery as well as content.
            </p>
            <input
              type="file"
              accept="video/*"
              onChange={(event) => setVideo(event.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2"
            />
          </details>
          <button
            onClick={submit}
            disabled={!interviewId || !transcript.trim()}
            className="mt-6 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            Get my feedback
          </button>
        </>
      )}
      {busy && !output && (
        <p className="mt-4 text-muted-foreground" aria-live="polite">
          Reading your answers…
        </p>
      )}
      {sections.length > 0 && (
        <div className="mt-6 space-y-6" aria-live="polite">
          {sections.map((section, i) => (
            <div key={i}>
              {section.title && (
                <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  {section.title}
                </h3>
              )}
              <div className="mt-2 space-y-2 leading-relaxed">
                {section.lines.map((line, j) =>
                  /^[-*•]\s|^\d+\.\s/.test(line) ? (
                    <p key={j} className="border-l-2 border-accent/50 pl-3">
                      {line.replace(/^[-*•]\s|^\d+\.\s/, "")}
                    </p>
                  ) : (
                    <p key={j}>{line}</p>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {busy && (
        <button
          onClick={() => abortRef.current?.abort()}
          className="mt-6 rounded-full border px-4 py-2 text-sm"
        >
          Stop
        </button>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

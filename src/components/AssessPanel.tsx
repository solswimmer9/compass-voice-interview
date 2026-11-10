import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isPreviewBrowser } from "@/lib/preview";

function readDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AssessPanel({ initialTranscript, interviewId }: { initialTranscript: string; interviewId: string | null }) {
  const [transcript, setTranscript] = useState(initialTranscript);
  const [video, setVideo] = useState<File | null>(null);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (initialTranscript) setTranscript(initialTranscript);
  }, [initialTranscript]);

  const submit = async () => {
    setError(null);
    setOutput("");
    if (!interviewId) return setError("Start an interview before requesting feedback.");
    if (video && video.size > 20 * 1024 * 1024) return setError("Video must be under 20 MB.");
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const preview = isPreviewBrowser();
      const { data: sessionData } = preview ? { data: { session: null } } : await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!preview && !token) throw new Error("Sign in to request feedback.");
      const body: Record<string, string> = { transcript, interviewId };
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
        const [main, streamError] = text.split("[[error]]");
        setOutput(main ?? "");
        if (streamError) setError(streamError);
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Assessment failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-12 rounded-md border bg-card p-6">
      <h2 className="font-serif text-3xl font-semibold">Assess my reasoning</h2>
      <p className="mt-1 text-sm text-muted-foreground">Submit your replay, an optional video, or both. Each interview includes one AI feedback assessment.</p>
      <textarea
        value={transcript}
        onChange={(event) => setTranscript(event.target.value)}
        rows={6}
        placeholder="Dr Hale: Why do cities exist where they do?&#10;You: ..."
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
        {busy && <button onClick={() => abortRef.current?.abort()} className="rounded-full border px-4 py-2 text-sm">Stop</button>}
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      {busy && !output && <p className="mt-6 text-sm text-muted-foreground">Reading your answers…</p>}
      {output && <div className="mt-6 whitespace-pre-wrap leading-relaxed">{output.replace(/^#+\s?/gm, "").replace(/\*\*/g, "")}</div>}
    </section>
  );
}

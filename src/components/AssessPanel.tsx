import { useEffect, useRef, useState } from "react";

function readDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function AssessPanel({ initialTranscript }: { initialTranscript: string }) {
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
    if (video && video.size > 20 * 1024 * 1024) return setError("Video must be under 20 MB.");
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const body: Record<string, string> = { transcript };
      if (video) {
        body["video"] = await readDataURL(video);
        body["videoType"] = video.type || "video/mp4";
      }
      const res = await fetch("/api/assess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Assessment failed");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        const [main, err] = text.split("[[error]]");
        setOutput(main ?? "");
        if (err) setError(err);
      }
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Assessment failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-12 rounded-md border bg-card p-6">
      <h2 className="font-serif text-3xl font-semibold">Assess my reasoning</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Submit your replay (paste a transcript, add a video of yourself answering, or both) for AI
        feedback.
      </p>
      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        rows={6}
        placeholder="Dr Hale: Why do cities exist where they do?&#10;You: ..."
        className="mt-4 w-full rounded-md border bg-background p-3 text-sm"
      />
      <label className="mt-3 block text-sm">
        <span className="text-muted-foreground">Optional video (under 20 MB)</span>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2"
        />
      </label>
      <div className="mt-4 flex gap-3">
        <button
          onClick={submit}
          disabled={busy || (!transcript.trim() && !video)}
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
      {busy && !output && (
        <p className="mt-6 text-sm text-muted-foreground">Reading your answers…</p>
      )}
      {output && (
        <div className="mt-6 whitespace-pre-wrap leading-relaxed">
          {output.replace(/^#+\s?/gm, "").replace(/\*\*/g, "")}
        </div>
      )}
    </section>
  );
}

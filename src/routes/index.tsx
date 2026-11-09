import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";
import { AssessPanel } from "@/components/AssessPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Geography Interview Sparring Partner | Oxbridge Practice" },
      {
        name: "description",
        content: "A voice tutor asks Cambridge-style geography questions and challenges your reasoning like a real interviewer.",
      },
      { property: "og:title", content: "Geography Interview Sparring Partner" },
      {
        property: "og:description",
        content: "Practise your Oxbridge geography interview out loud, then replay the transcript.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Line = { role: "user" | "assistant"; text: string };

function Index() {
  const [lines, setLines] = useState<Line[]>([]);
  const [ended, setEnded] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const onEvent = useCallback((event: LiveEvent) => {
    const role =
      event.type === "session.input_transcript.delta"
        ? "user"
        : event.type === "session.output_transcript.delta"
          ? "assistant"
          : null;
    const delta = event["delta"];
    if (role && typeof delta === "string") {
      setLines((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === role) {
          return [...prev.slice(0, -1), { role, text: last.text + delta }];
        }
        return [...prev, { role, text: delta }];
      });
    }
    if (event.type === "app.greeting.error") setNote(event.error?.message ?? null);
  }, []);

  const call = useLiveVoice({ onEvent });
  const idle = call.status === "idle" || call.status === "closed";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lines]);

  const start = () => {
    setLines([]);
    setEnded(false);
    setNote(null);
    call.start();
  };
  const stop = () => {
    setEnded(true);
    call.stop();
  };

  const showReplay = ended && idle && lines.length > 0;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-accent">Oxbridge practice · Geography</p>
      <h1 className="mt-3 font-serif text-5xl font-semibold leading-tight">Interview sparring partner</h1>
      <p className="mt-4 text-muted-foreground">
        Dr Hale asks a Cambridge-style question, then pushes back on your reasoning. Think aloud — that's the point.
      </p>

      <section className="mt-10 rounded-md border bg-card p-6">
        <div className="flex flex-wrap items-center gap-3">
          {idle ? (
            <button
              onClick={start}
              className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:opacity-90"
            >
              {ended ? "Start a new interview" : "Start interview"}
            </button>
          ) : (
            <>
              <span
                className={`h-3 w-3 rounded-full bg-accent ${call.status === "connected" ? "live-pulse" : "opacity-50"}`}
              />
              <span className="text-sm text-muted-foreground">
                {call.status === "connected" ? "In the interview room" : call.status === "stopping" ? "Wrapping up…" : "Connecting…"}
              </span>
              <button
                disabled={call.status !== "connected"}
                onClick={() => call.setMuted(!call.muted)}
                className="ml-auto rounded-full border px-4 py-2 text-sm disabled:opacity-40"
              >
                {call.muted ? "Unmute" : "Mute"}
              </button>
              <button
                disabled={call.status === "stopping"}
                onClick={stop}
                className="rounded-full bg-destructive px-4 py-2 text-sm text-destructive-foreground disabled:opacity-40"
              >
                End interview
              </button>
            </>
          )}
          {call.playbackBlocked && (
            <button onClick={call.resumePlayback} className="rounded-full border px-4 py-2 text-sm">
              Play voice
            </button>
          )}
        </div>
        {call.error && <p role="alert" className="mt-4 text-sm text-destructive">{call.error}</p>}
        {note && <p className="mt-4 text-sm text-muted-foreground">{note}</p>}
        <audio ref={call.audioRef} controls className="mt-4 h-8 w-full opacity-60" />
      </section>

      {lines.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-3xl font-semibold">{showReplay ? "Replay" : "Transcript"}</h2>
          {showReplay && (
            <p className="mt-1 text-sm text-muted-foreground">
              Read back how you argued. Where did Dr Hale push hardest?
            </p>
          )}
          <ol className="mt-6 space-y-5">
            {lines.map((line, i) => (
              <li key={i} className={line.role === "assistant" ? "border-l-2 border-accent pl-4" : "pl-4"}>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {line.role === "assistant" ? "Dr Hale" : "You"}
                </p>
                <p className={line.role === "assistant" ? "mt-1 font-serif text-xl italic" : "mt-1"}>{line.text}</p>
              </li>
            ))}
          </ol>
          <div ref={endRef} />
        </section>
      )}

      {(idle || showReplay) && (
        <AssessPanel
          initialTranscript={showReplay ? lines.map((l) => `${l.role === "assistant" ? "Dr Hale" : "You"}: ${l.text.trim()}`).join("\n\n") : ""}
        />
      )}
    </main>
  );
}

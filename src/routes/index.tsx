import { ConversationProvider } from "@elevenlabs/react";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useElevenLabsInterview, type InterviewEvent } from "@/hooks/use-elevenlabs-interview";
import { AssessPanel } from "@/components/AssessPanel";
import { FlippingWord } from "@/components/FlippingWord";
import { DotPattern } from "@/components/ui/dot-pattern";
import { INTERVIEW_MINUTES } from "@/lib/limits";

const HEADLINE_WORDS = ["democratise", "open up", "demystify", "widen access to"];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "We are here to democratise Oxbridge" },
      {
        name: "description",
        content:
          "A voice tutor asks Cambridge-style geography questions and challenges your reasoning like a real interviewer.",
      },
      { property: "og:title", content: "We are here to democratise Oxbridge" },
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
  return (
    <ConversationProvider>
      <InterviewPage />
    </ConversationProvider>
  );
}

function InterviewPage() {
  const [lines, setLines] = useState<Line[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const onEvent = useCallback((event: InterviewEvent) => {
    if (event.type === "app.transcript") {
      setLines((prev) => [...prev, { role: event.role, text: event.text }]);
      return;
    }
    setLines((prev) => {
      const next = [...prev];
      for (let index = next.length - 1; index >= 0; index--) {
        const line = next[index];
        if (line?.role === "assistant" && line.text === event.originalText) {
          next[index] = { ...line, text: event.correctedText };
          return next;
        }
      }
      return prev;
    });
  }, []);

  const call = useElevenLabsInterview({ onEvent });
  const idle = call.status === "idle" || call.status === "closed";

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (call.status !== "connected") return;
    const startedAt = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [call.status]);
  const clock = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lines]);

  const start = () => {
    setLines([]);
    void call.start();
  };

  // Also true after a dropped call, so an interview that ended early can still be assessed.
  const showReplay = idle && lines.length > 0;

  return (
    <div className="relative min-h-[100svh] overflow-hidden">
      <DotPattern className="h-[100svh] [mask-image:radial-gradient(520px_circle_at_center,white,transparent)]" />
      <main className="relative z-10 mx-auto flex min-h-[100svh] max-w-2xl flex-col justify-center px-6 py-16">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            Oxbridge practice · Geography
          </p>
          <h1
            aria-label="We are here to democratise Oxbridge"
            className="mt-4 text-4xl font-medium leading-tight tracking-tighter sm:text-6xl"
          >
            <span aria-hidden="true" className="block">
              We are here to
            </span>
            <span aria-hidden="true" className="block">
              <FlippingWord words={HEADLINE_WORDS} />
            </span>
            <span aria-hidden="true" className="block">
              Oxbridge
            </span>
          </h1>
          <div className="mx-auto mt-6 max-w-xl bg-background shadow-[0_0_20px_16px_var(--background)]">
            <p className="text-lg font-medium">
              Built by Cambridge students for applicants, based on real context.
            </p>
            <p className="mt-3 text-foreground/90">
              Preparing for an Oxbridge interview has been too hard for too long. We change that.
            </p>
            <p className="mt-2 text-foreground/90">
              Practise out loud with Dr Hale, an AI tutor informed by real Cambridge geography
              notes, who will challenge your reasoning.
            </p>
          </div>
          <ol className="mt-8 grid gap-3 text-left text-sm sm:grid-cols-3">
            <li className="rounded-md border bg-card p-3">
              <span className="font-medium">1. Talk.</span>{" "}
              <span className="text-muted-foreground">
                Up to {INTERVIEW_MINUTES} minutes, using your microphone.
              </span>
            </li>
            <li className="rounded-md border bg-card p-3">
              <span className="font-medium">2. Read back.</span>{" "}
              <span className="text-muted-foreground">See the transcript of how you argued.</span>
            </li>
            <li className="rounded-md border bg-card p-3">
              <span className="font-medium">3. Get feedback.</span>{" "}
              <span className="text-muted-foreground">Find out where your reasoning slipped.</span>
            </li>
          </ol>
        </div>

        <section className="mt-6 rounded-md border bg-card p-6">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {idle ? (
              <button
                onClick={start}
                className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:opacity-90"
              >
                {showReplay ? "Start a new interview" : "Start interview"}
              </button>
            ) : (
              <>
                <span
                  className={`h-3 w-3 rounded-full bg-accent ${call.status === "connected" ? "live-pulse" : "opacity-50"}`}
                />
                <span className="text-sm text-muted-foreground">
                  {call.status === "connected"
                    ? `In the interview room · ${clock(Math.min(elapsed, INTERVIEW_MINUTES * 60))} of ${INTERVIEW_MINUTES}:00`
                    : call.status === "stopping"
                      ? "Wrapping up…"
                      : "Connecting…"}
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
                  onClick={call.stop}
                  className="rounded-full bg-destructive px-4 py-2 text-sm text-destructive-foreground disabled:opacity-40"
                >
                  End interview
                </button>
              </>
            )}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Dr Hale speaks with a natural British voice from ElevenLabs.
          </p>
          {call.error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {call.error}
            </p>
          )}
        </section>

        {lines.length > 0 && (
          <section className="mt-10">
            <h2 className="font-serif text-3xl font-semibold">
              {showReplay ? "Replay" : "Transcript"}
            </h2>
            {showReplay && (
              <p className="mt-1 text-sm text-muted-foreground">
                Read back how you argued. Where did Dr Hale push hardest?
              </p>
            )}
            <ol className="mt-6 space-y-5">
              {lines.map((line, i) => (
                <li
                  key={i}
                  className={line.role === "assistant" ? "border-l-2 border-accent pl-4" : "pl-4"}
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {line.role === "assistant" ? "Dr Hale" : "You"}
                  </p>
                  <p
                    className={
                      line.role === "assistant" ? "mt-1 font-serif text-xl italic" : "mt-1"
                    }
                  >
                    {line.text}
                  </p>
                </li>
              ))}
            </ol>
            <div ref={endRef} />
          </section>
        )}

        {showReplay && (
          <AssessPanel
            initialTranscript={lines
              .map((l) => `${l.role === "assistant" ? "Dr Hale" : "You"}: ${l.text.trim()}`)
              .join("\n\n")}
          />
        )}
      </main>
      <footer className="relative z-10 mx-auto max-w-2xl px-6 pb-10 text-center text-xs text-muted-foreground">
        Independent practice tool, not affiliated with the University of Cambridge or the University
        of Oxford. Dr Hale is an AI and can make mistakes.
      </footer>
    </div>
  );
}

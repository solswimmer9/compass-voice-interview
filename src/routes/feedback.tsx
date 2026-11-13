import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AssessPanel } from "@/components/AssessPanel";
import { SiteNav } from "@/components/SiteNav";
import { useAccountSnapshot } from "@/hooks/useAccountSnapshot";
import { loadFinishedInterview, type FinishedInterview } from "@/lib/finished-interview";

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [{ title: "Your feedback letter | Oxbridge Interview Practice" }],
  }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const account = useAccountSnapshot();
  // Read in the browser only: the interview is kept in this tab's sessionStorage.
  const [interview, setInterview] = useState<FinishedInterview | null | undefined>(undefined);
  useEffect(() => setInterview(loadFinishedInterview()), []);

  if (interview === undefined) return null;

  const tutorName = interview?.tutor === "ppe" ? "Prof Matt" : "Dr River";

  return (
    <div className="relative min-h-[100svh]">
      <SiteNav back="home" />
      <main className="relative z-10 mx-auto max-w-2xl px-6 pb-16 pt-12">
        {!interview ? (
          <section className="py-24 text-center">
            <h1 className="text-2xl font-medium tracking-tight">No interview to write about yet</h1>
            <p className="mt-3 text-muted-foreground">
              Your feedback letter appears here after an interview.
            </p>
            <Link
              to="/subjects"
              className="mt-8 inline-flex rounded-full bg-primary px-7 py-3 font-medium text-primary-foreground"
            >
              Pick a subject
            </Link>
          </section>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
              {interview.tutor === "ppe" ? "PPE" : "Geography"} · {tutorName}
            </p>
            <h1 className="mt-2 text-3xl font-medium tracking-tight">Your feedback letter</h1>

            <div className="mt-8">
              <AssessPanel
                interview={interview}
                studentName={account.data?.profile?.display_name}
              />
            </div>

            <details className="mt-10 rounded-md border border-dashed p-6">
              <summary className="cursor-pointer font-medium">Read back the transcript</summary>
              <ol className="mt-6 space-y-5">
                {interview.lines.map((line, i) => (
                  <li
                    key={i}
                    className={line.role === "assistant" ? "border-l-2 border-accent pl-4" : "pl-4"}
                  >
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {line.role === "assistant" ? tutorName : "You"}
                    </p>
                    <p
                      className={
                        line.role === "assistant" ? "mt-1 font-serif text-lg italic" : "mt-1"
                      }
                    >
                      {line.text}
                    </p>
                  </li>
                ))}
              </ol>
            </details>

            <section className="mt-12 rounded-md border bg-card p-6 text-center sm:p-8">
              <h2 className="text-xl font-medium tracking-tight">Keep practising</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The real interview rewards practice. Get more interviews, or lifetime access.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                <Link
                  to="/pricing"
                  className="rounded-full bg-primary px-7 py-3 font-medium text-primary-foreground transition hover:opacity-90"
                >
                  See pricing
                </Link>
                <Link to="/" className="text-sm text-muted-foreground underline">
                  Back to home
                </Link>
              </div>
            </section>
          </>
        )}
      </main>
      <footer className="relative z-10 mx-auto max-w-2xl px-6 pb-10 text-center text-xs text-muted-foreground">
        Not affiliated with Oxford or Cambridge. AI can make mistakes.
      </footer>
    </div>
  );
}

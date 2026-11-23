import { createFileRoute, Link } from "@tanstack/react-router";
import { MeridianPage, Rose, darkButton, mono, serif } from "@/components/meridian/MeridianFrame";
import { INTERVIEW_MINUTES, OBJECT_REVEAL_MINUTES } from "@/lib/limits";
import { readingsFor } from "@/lib/readings";
import { SUBJECTS, type SubjectId } from "@/lib/subjects";
import { useAccountSnapshot } from "@/hooks/useAccountSnapshot";
import graduate from "@/assets/home/graduate.webp";
import reader from "@/assets/home/reader.webp";
import writer from "@/assets/home/writer.webp";

// "Start interview" opens the interview room, which connects straight away behind a short waiting
// room. A subject with practice readings also offers "start with a reading". Sign-in, credits and
// feedback rules are enforced in the room and on the server.

export const Route = createFileRoute("/subjects")({
  head: () => ({
    meta: [
      { title: "Pick a subject | Oxbridge Interview Practice" },
      { name: "description", content: "Pick a subject and start a practice Oxbridge interview." },
      { property: "og:title", content: "Pick a subject" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: SubjectsPage,
});

/** Each tutor's sketch portrait, the same ones the interview orb will use. */
const PORTRAITS: Record<SubjectId, { src: string; alt: string }> = {
  ppe: { src: graduate, alt: "Sketch portrait of Prof Matt in cap and gown" },
  geography: { src: reader, alt: "Sketch portrait of Dr River reading" },
  // shortcut: placeholder sketch until Dr Toby's own portrait design lands.
  biology: { src: writer, alt: "Sketch portrait of Dr Toby writing" },
};

function SubjectsPage() {
  const account = useAccountSnapshot();
  // Display only: the server refuses students a tutor with nothing approved anyway.
  const subjects = SUBJECTS.filter((s) => !s.testersOnly || account.data?.tester);
  return (
    <MeridianPage
      framed={
        <section className="px-6 pb-16 pt-10 text-center sm:px-8 sm:pt-14">
          <p className={`${mono} text-xs text-[#5a5a57]`}>PICK A SUBJECT</p>
          <h1
            className={`rise ${serif} mt-4 text-[clamp(44px,6vw,88px)] leading-[0.98] tracking-[-0.02em]`}
          >
            Who would you like
            <br />
            <em>to be interviewed by?</em>
          </h1>
          <p
            className="rise mx-auto mt-5 max-w-[540px] text-base leading-relaxed text-[#4a4a48]"
            style={{ animationDelay: "0.15s" }}
          >
            Up to {INTERVIEW_MINUTES} minutes, out loud. Partway through, your tutor will put a
            chart on the table for you to reason about. Every subject ends with a feedback letter
            from your tutor.
          </p>
          <div className="mx-auto mt-10 grid max-w-[720px] grid-cols-1 border-l border-t border-[#d6d6d2] text-left sm:grid-cols-3">
            {[
              `${INTERVIEW_MINUTES} MIN · SPOKEN`,
              `CHART · MINUTE ${OBJECT_REVEAL_MINUTES}`,
              "LETTER · AFTER",
            ].map((label, i) => (
              <div
                key={label}
                className={`cell border-b border-r border-[#d6d6d2] px-[18px] py-5 ${mono} text-xs text-[#4a4a48]`}
                style={{ animationDelay: `${0.25 + i * 0.08}s` }}
              >
                {label}
              </div>
            ))}
          </div>
        </section>
      }
    >
      <main className="px-2 pb-28 pt-16">
        <ul className="grid gap-6 lg:grid-cols-2">
          {subjects.map((s) => {
            const readings = readingsFor(s.id);
            const portrait = PORTRAITS[s.id];
            return (
              <li
                key={s.id}
                className="lift reveal flex flex-col rounded-[14px] bg-[#f7f7f5] p-6 sm:p-8"
              >
                <div className="relative mx-auto h-[360px] w-full max-w-[380px] overflow-hidden">
                  <Rose count={14} size={280} step={12} />
                  <img
                    src={portrait.src}
                    alt={portrait.alt}
                    className="absolute left-1/2 top-1/2 size-[150px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#161616] bg-white object-cover grayscale"
                  />
                </div>
                <p className={`${mono} mt-6 text-xs text-[#5a5a57]`}>
                  WITH {s.tutor.toUpperCase()}
                </p>
                <h2 className={`${serif} mt-2 text-[clamp(44px,5vw,64px)] leading-none`}>
                  {s.name}
                </h2>
                <p className="mt-4 flex-1 text-[15px] leading-relaxed text-[#4a4a48]">{s.line}</p>
                <p className={`${mono} mt-4 text-xs text-[#5a5a57]`}>
                  ENDS WITH A FEEDBACK LETTER FROM {s.tutor.toUpperCase()}
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                  <Link
                    to="/interview"
                    search={{ tutor: s.id, start: true as const }}
                    className={darkButton}
                  >
                    Start interview →
                  </Link>
                  {readings.length > 0 ? (
                    <Link
                      to="/readings"
                      search={{ subject: s.id }}
                      className="text-sm underline underline-offset-4 hover:text-[#4a4a48]"
                    >
                      Or start with a practice reading ({readings.length} articles)
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </MeridianPage>
  );
}

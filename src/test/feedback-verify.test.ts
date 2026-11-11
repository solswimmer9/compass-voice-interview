import { describe, expect, it } from "vitest";
import { parseTranscript } from "@/lib/feedback/transcript";
import { normalise, tooThinToAssess, verifyObservations } from "@/lib/feedback/verify-quotes";
import { findSlop } from "@/lib/feedback/slop";
import type { Observation, Turn } from "@/lib/feedback/types";

const transcript = [
  "Dr River: Why might a river change its course?",
  "You: I think it’s because the outer bank erodes faster — so the meander migrates downstream.",
  "Dr River: What would stop that from continuing forever?",
  "You: Well, a cut-off forms when two bends meet, and that leaves an oxbow lake.",
  "Dr River: Good. And the human angle?",
  "You: Um... flood defences, I suppose.",
].join("\n\n");

const turns = parseTranscript(transcript);

const obs = (over: Partial<Observation> & Pick<Observation, "evidence">): Observation => ({
  id: "o1",
  criterionId: "c1",
  kind: "strength",
  claim: "claim",
  ...over,
});

describe("parseTranscript", () => {
  it("numbers turns and assigns roles", () => {
    expect(turns).toHaveLength(6);
    expect(turns.map((t) => t.role)).toEqual([
      "assistant",
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
    ]);
    expect(turns[1]!.turn).toBe(2);
    expect(turns[1]!.text.startsWith("I think")).toBe(true);
  });
  it("tolerates extra whitespace, CRLF and multi-line turns", () => {
    const t = parseTranscript("  You:   hello\r\n   there  \r\n\r\n\r\n\r\n  Dr River:  hi  \n\n");
    expect(t).toEqual([
      { turn: 1, role: "user", text: "hello there" },
      { turn: 2, role: "assistant", text: "hi" },
    ]);
  });
  it("appends unlabelled blocks to the previous turn", () => {
    const t = parseTranscript("You: first part\n\nsecond part\n\nDr River: ok");
    expect(t).toHaveLength(2);
    expect(t[0]!.text).toBe("first part second part");
  });
  it("accepts a custom tutor name", () => {
    const t = parseTranscript("Prof Ash: hello\n\nYou: hi", "Prof Ash");
    expect(t.map((x) => x.role)).toEqual(["assistant", "user"]);
  });
  it("returns [] for empty or non-string input", () => {
    expect(parseTranscript("")).toEqual([]);
    expect(parseTranscript("   \n\n ")).toEqual([]);
    expect(parseTranscript(undefined as unknown as string)).toEqual([]);
  });
});

describe("normalise", () => {
  it("unifies case, quotes, dashes, punctuation and whitespace", () => {
    expect(normalise("  It’s   a “Cut-off” — really!  ")).toBe("its a cut off really");
    expect(normalise('It\'s a "cut-off" - really')).toBe("its a cut off really");
  });
  it("handles non-strings", () => {
    expect(normalise(undefined as unknown as string)).toBe("");
  });
});

describe("verifyObservations", () => {
  it("keeps an exact quote on the right student turn", () => {
    const { verified, dropped } = verifyObservations(
      [obs({ evidence: [{ turn: 2, quote: "the outer bank erodes faster" }] })],
      turns,
    );
    expect(verified).toHaveLength(1);
    expect(verified[0]!.evidence[0]).toEqual({ turn: 2, quote: "the outer bank erodes faster" });
    expect(dropped).toHaveLength(0);
  });

  it("matches despite punctuation, quote-mark and dash differences", () => {
    const { verified } = verifyObservations(
      [
        obs({
          evidence: [
            {
              turn: 2,
              quote:
                "I think it's because the outer bank erodes faster, so the meander migrates downstream",
            },
            { turn: 4, quote: "A CUT OFF forms when two bends meet" },
          ],
        }),
      ],
      turns,
    );
    expect(verified[0]!.evidence).toHaveLength(2);
    expect(verified[0]!.evidence.every((e) => !e.corrected)).toBe(true);
  });

  it("corrects a wrong turn number when the quote is in exactly one student turn", () => {
    const { verified } = verifyObservations(
      [obs({ evidence: [{ turn: 6, quote: "a cut-off forms when two bends meet" }] })],
      turns,
    );
    expect(verified[0]!.evidence[0]).toMatchObject({ turn: 4, corrected: true });
  });

  it("does not correct when the quote appears in several student turns", () => {
    const t: Turn[] = [
      { turn: 1, role: "user", text: "I really do not know the answer" },
      { turn: 2, role: "user", text: "I really do not know the answer" },
    ];
    const { verified, dropped } = verifyObservations(
      [obs({ evidence: [{ turn: 5, quote: "really do not know" }] })],
      t,
    );
    expect(verified).toHaveLength(0);
    expect(dropped).toHaveLength(1);
  });

  it("rejects quotes from the tutor's turns", () => {
    const { verified, dropped } = verifyObservations(
      [obs({ evidence: [{ turn: 1, quote: "Why might a river change its course" }] })],
      turns,
    );
    expect(verified).toHaveLength(0);
    expect(dropped[0]!.reason).toMatch(/not a student turn/);
  });

  it("rejects a tutor quote even when the tutor turn is named wrongly as a student turn", () => {
    const { verified } = verifyObservations(
      [obs({ evidence: [{ turn: 2, quote: "What would stop that from continuing forever" }] })],
      turns,
    );
    expect(verified).toHaveLength(0);
  });

  it("rejects fabricated quotes and non-existent turns", () => {
    const { verified, dropped } = verifyObservations(
      [
        obs({ id: "a", evidence: [{ turn: 2, quote: "glaciers carve u shaped valleys" }] }),
        obs({ id: "b", evidence: [{ turn: 99, quote: "the outer bank erodes faster" }] }),
      ],
      turns,
    );
    // b is rescued by turn correction; a is not.
    expect(verified.map((v) => v.id)).toEqual(["b"]);
    expect(dropped.map((d) => (d.observation as Observation).id)).toEqual(["a"]);
  });

  it("drops too-short quotes, and respects minWords", () => {
    const o = obs({ evidence: [{ turn: 6, quote: "flood defences" }] });
    expect(verifyObservations([o], turns).verified).toHaveLength(0);
    expect(verifyObservations([o], turns, { minWords: 2 }).verified).toHaveLength(1);
    expect(
      verifyObservations([obs({ evidence: [{ turn: 2, quote: "the outer bank" }] })], turns)
        .verified,
    ).toHaveLength(0);
  });

  it("does not match across word fragments", () => {
    const { verified } = verifyObservations(
      [obs({ evidence: [{ turn: 2, quote: "outer bank erodes fast" }] })],
      turns,
    );
    expect(verified).toHaveLength(0);
  });

  it("keeps an observation with at least one surviving quote and records the dropped one", () => {
    const { verified } = verifyObservations(
      [
        obs({
          evidence: [
            { turn: 2, quote: "the outer bank erodes faster" },
            { turn: 2, quote: "something never said here" },
          ],
        }),
      ],
      turns,
    );
    expect(verified[0]!.evidence).toHaveLength(1);
    expect(verified[0]!.droppedEvidence).toHaveLength(1);
  });

  it("drops an improvement whose only evidence is on unclear turns", () => {
    const t = turns.map((x) => (x.turn === 6 ? { ...x, unclear: true } : x));
    const imp = obs({
      kind: "improvement",
      evidence: [{ turn: 6, quote: "flood defences I suppose" }],
    });
    const r = verifyObservations([imp], t);
    expect(r.verified).toHaveLength(0);
    expect(r.dropped[0]!.reason).toMatch(/unclear/);
  });

  it("strips unclear evidence from an improvement but keeps it if clear evidence remains", () => {
    const t = turns.map((x) => (x.turn === 6 ? { ...x, unclear: true } : x));
    const imp = obs({
      kind: "improvement",
      evidence: [
        { turn: 6, quote: "flood defences I suppose" },
        { turn: 4, quote: "a cut-off forms when two bends meet" },
      ],
    });
    const r = verifyObservations([imp], t);
    expect(r.verified[0]!.evidence.map((e) => e.turn)).toEqual([4]);
  });

  it("still allows a strength to cite an unclear turn that matches", () => {
    const t = turns.map((x) => (x.turn === 6 ? { ...x, unclear: true } : x));
    const r = verifyObservations(
      [obs({ evidence: [{ turn: 6, quote: "flood defences I suppose" }] })],
      t,
    );
    expect(r.verified).toHaveLength(1);
  });

  it("drops observations with no evidence", () => {
    const r = verifyObservations([obs({ evidence: [] })], turns);
    expect(r.dropped[0]!.reason).toMatch(/no evidence/);
  });

  it("never throws on malformed input", () => {
    const bad = [
      null,
      undefined,
      42,
      "x",
      {},
      { evidence: "nope" },
      { id: "x", kind: "strength", evidence: [null, {}, { turn: "2", quote: 5 }, { turn: 2 }] },
    ] as unknown as Observation[];
    expect(() => verifyObservations(bad, turns)).not.toThrow();
    expect(verifyObservations(bad, turns).verified).toHaveLength(0);
    expect(() => verifyObservations(undefined as never, undefined as never)).not.toThrow();
    expect(verifyObservations([], [])).toEqual({ verified: [], dropped: [] });
    expect(
      verifyObservations([obs({ evidence: [{ turn: 1, quote: "a b c d e" }] })], []),
    ).toMatchObject({ verified: [] });
  });
});

describe("tooThinToAssess", () => {
  it("is true below two surviving observations", () => {
    expect(tooThinToAssess([])).toBe(true);
    expect(tooThinToAssess([1])).toBe(true);
    expect(tooThinToAssess([1, 2])).toBe(false);
    expect(tooThinToAssess(undefined as never)).toBe(true);
  });
});

describe("findSlop", () => {
  const rulesOf = (s: string) => findSlop(s).map((m) => m.rule);

  it("flags generic praise and filler", () => {
    expect(rulesOf("Great job! Keep up the good work.")).toEqual([
      "generic-praise",
      "generic-praise",
    ]);
    expect(rulesOf("Overall, you demonstrated strong communication skills.")).toEqual(
      expect.arrayContaining(["generic-summary", "generic-praise"]),
    );
    expect(rulesOf("You showed great potential.")).toContain("generic-praise");
    expect(rulesOf("Let us delve into it. It’s important to note the following.")).toEqual([
      "filler",
      "filler",
    ]);
    expect(rulesOf("A truly outstanding answer, simply superb.")).toContain("empty-superlative");
  });

  it("flags scores", () => {
    expect(rulesOf("I'd give this 7/10.")).toEqual(["score"]);
    expect(rulesOf("That is eight out of ten.")).toEqual(["score"]);
    expect(rulesOf("You scored 6 overall.")).toEqual(["score"]);
  });

  it("flags admission predictions", () => {
    expect(rulesOf("You will get in with answers like this.")).toEqual(["admission-prediction"]);
    expect(rulesOf("You are likely to receive an offer.")).toEqual(["admission-prediction"]);
    expect(rulesOf("Your chances look good.")).toEqual(["admission-prediction"]);
  });

  it("flags accent, fluency, appearance and body language, in British and American spellings", () => {
    expect(rulesOf("Your accent was clear.")).toEqual(["delivery-comment"]);
    expect(rulesOf("You were very fluent.")).toEqual(["delivery-comment"]);
    expect(rulesOf("Good body language and eye contact.")).toEqual([
      "delivery-comment",
      "delivery-comment",
    ]);
    expect(rulesOf("Your demeanour was calm.")).toEqual(["delivery-comment"]);
    expect(rulesOf("Your demeanor was calm.")).toEqual(["delivery-comment"]);
    expect(rulesOf("Great composure.")).toEqual(["delivery-comment"]);
  });

  it("flags character labels", () => {
    expect(rulesOf("You lack confidence.")).toEqual(["character-label"]);
    expect(rulesOf("You are a natural.")).toEqual(["character-label"]);
    expect(rulesOf("You're clearly intelligent.")).toEqual(["character-label"]);
  });

  it("reports phrase, index and rule", () => {
    const m = findSlop("Fine start. Great job overall.");
    expect(m).toEqual([{ phrase: "Great job", index: 12, rule: "generic-praise" }]);
  });

  it("handles curly apostrophes and extra whitespace", () => {
    expect(rulesOf("It’s   important to note this")).toEqual(["filler"]);
  });

  it("produces no matches for clean, specific feedback", () => {
    const clean = [
      "At turn 2 you said the outer bank erodes faster, and followed it to meander migration. That is a causal chain.",
      "At turn 4 you reached for a cut-off and an oxbow lake before being asked for an example.",
      "At turn 6 you named flood defences but gave no reason. Next time, say why they alter the channel, then give one case.",
      "Read about the 2007 Severn floods to see how channel management changes erosion.",
      "Pace: you paused to think aloud before the second question, which helped your reasoning.",
      "",
    ];
    for (const c of clean) expect(findSlop(c)).toEqual([]);
  });

  it("does not match inside longer words", () => {
    expect(findSlop("The delvers of the delta were studied.")).toEqual([]);
    expect(findSlop("")).toEqual([]);
    expect(findSlop(undefined as unknown as string)).toEqual([]);
  });
});

// PCR roadmap scenario for Dr Toby. Written by Tim (decision tree v1 and roadmap v2, 15 November
// 2026) and converted into this format. The step-5 numbers (40 molecules, one billion copies)
// were filled in by Claude because the original left them blank: Tim should check them. Steps 3
// and 4 are reworded so that, while the tutor holds them as "next question", they do not give
// away the answer to the step before.
import type { Scenario } from "../types.ts";
import { flowSvg, thermalCycleSvg } from "./diagrams.ts";

const scenario: Scenario = {
  id: "bio-pcr",
  tutor: "biology",
  status: "approved",
  title: "PCR",
  author: "Tim McManus",
  knowledge: `Definition and purpose: polymerase chain reaction (PCR) amplifies (copies, increases the amount of) a DNA sample.
Reaction mixture: template DNA, DNA polymerase (heat-stable), free nucleotides, primers, magnesium ions (Mg2+).
Thermal cycling, three stages per cycle: denaturation at about 90 degrees C (94-98 in practice) breaks the hydrogen bonds between strands to separate them; annealing at 50-65, about 55, lets primers bind to their target sequences; extension at 72 is the polymerase's optimum for adding nucleotides.
Primer stability: primers do not melt off when the temperature rises from 55 to 72 because the polymerase starts extending them straight away; the longer, extended primer forms more hydrogen bonds with the template, so its melting temperature rises above 72.
Numbers: amplification is exponential, doubling each cycle (2 to the n). From 40 identical molecules to at least one billion copies: 40 x 2^n >= 10^9, so 2^n >= 25 million; 2^24 is about 16.8 million and 2^25 about 33.5 million, so 25 cycles. Shortcut: 2^10 is about 1,000, so 2^30 is about a billion, and 40 is between 2^5 and 2^6.
Different strands: if the 40 starting molecules are all different and we want one of them, that one starts as a single copy. Getting one copy to at least 40 takes 6 doublings (2^5 = 32 is too few, 2^6 = 64), and from there the earlier 25 cycles apply, so 6 extra rounds, 31 in all. No full recalculation is needed.`,
  steps: [
    {
      id: "what-is-pcr",
      ask: "What can you tell me about the process of PCR?",
      points: [
        { id: "name", text: "PCR stands for polymerase chain reaction" },
        { id: "purpose", text: "it amplifies or copies DNA, increasing the amount in a sample" },
        { id: "polymerase", text: "the mixture contains DNA polymerase" },
        { id: "nucleotides", text: "the mixture contains free nucleotides" },
        { id: "primers", text: "the mixture contains primers" },
        { id: "magnesium", text: "the mixture contains magnesium ions (Mg2+)" },
        { id: "cycling", text: "the mixture is cycled through different temperatures" },
      ],
      hints: [
        "Good, and is there anything else the reaction mixture needs for a successful reaction?",
        "And what do we need to do to the reaction mixture for the reaction to happen?",
        "And what is the point of PCR: why do we do it?",
      ],
      answer:
        "So PCR is the polymerase chain reaction. We mix the DNA with DNA polymerase, free nucleotides, primers and magnesium ions, then put it through thermal cycling, cycling through different temperatures, to make many copies of the DNA.",
      rules: [
        "If they name some mixture items but not all, ask whether the mixture needs anything else. Allow one more try; if items are still missing, say: Almost there, but we still need, then name the missing ones.",
        "If they have the whole mixture but not thermal cycling, ask what we need to do to the mixture for the reaction to happen. If they cannot say, tell them we cycle the mixture through different temperatures, a process called thermal cycling.",
        "If they never say why we do PCR, ask. If they say anything like copying, doubling or increasing DNA, confirm: to increase the amount of DNA in a sample.",
      ],
    },
    {
      id: "temperatures",
      ask: "Let's talk temperatures. Do you know which temperatures PCR uses, and in what order?",
      points: [
        { id: "temp-denature", text: "a first stage at about 90-95 degrees C" },
        { id: "temp-anneal", text: "a stage at about 50-65 degrees C (about 55)" },
        { id: "temp-extend", text: "a stage at about 72 degrees C" },
        { id: "temp-order", text: "the order is hot (about 90), then about 55, then 72" },
      ],
      hints: ["There are three stages in each cycle. Which one do you think needs to be hottest?"],
      answer:
        "In the three stages we cycle from about 90, down to about 55, then up to 72 degrees.",
      rules: [
        "If they give the right temperatures in the wrong order, say: Ah, you're almost correct, just the wrong order: it goes from 90 to 55 to 72. Then move on.",
        "If they give wrong values or the wrong number of stages, say: Not quite, in the three stages we cycle from 90 to 55 to 72. Then move on.",
        "Allow ranges and approximations: 90 to 98, 50 to 65, about 72.",
      ],
    },
    {
      id: "why-temperatures",
      ask: "Let me put those three temperatures up on a diagram. The question now is: why do we use each of them?",
      points: [
        { id: "why-90", text: "about 90 breaks the hydrogen bonds and separates the two strands" },
        { id: "why-55", text: "about 55 lets the primers anneal (bind) to the template" },
        { id: "why-72", text: "72 is the temperature at which the polymerase extends the strand" },
      ],
      hints: ["Think of three jobs that have to happen in each cycle, in order."],
      answer:
        "At 90 we break the hydrogen bonds and separate the strands; at 55 the primers anneal to the template; at 72 the polymerase extends the new strand.",
      rules: [
        "If any of the three is missing or wrong, correct just that part in a sentence, then move on.",
      ],
      diagram: {
        id: "bio-pcr-1",
        svg: thermalCycleSvg([
          { label: "Stage 1", celsius: 90 },
          { label: "Stage 2", celsius: 55 },
          { label: "Stage 3", celsius: 72 },
        ]),
        alt: "A line graph of temperature against time. The line repeats a cycle of three flat stages: stage 1 at 90 degrees Celsius, stage 2 at 55 degrees and stage 3 at 72 degrees.",
        shows:
          "Temperature against time for two PCR cycles: stage 1 at 90 C, stage 2 at 55 C, stage 3 at 72 C, repeating. The stages are numbered, not named.",
      },
    },
    {
      id: "primers-stay",
      ask: "Excellent, so let's dig a little deeper. When we heat the mixture back up to 72 degrees, why don't the primers melt off?",
      points: [
        {
          id: "extend-at-once",
          text: "the polymerase starts extending the primer straight away, so it gets longer",
        },
        {
          id: "more-bonds",
          text: "the extended primer forms more hydrogen bonds with the template, so its melting temperature rises above 72",
        },
      ],
      hints: [
        "Think about what happens once the primers anneal.",
        "Think about what will happen to the number of hydrogen bonds when the polymerase starts acting.",
      ],
      answer:
        "The polymerase starts extending the primer straight away, so by the time we reach 72 it is longer and held by many more hydrogen bonds, which pushes its melting temperature above 72.",
      rules: [
        "If they ask what melting means here, that is a clarifying question: answer it directly (the strands coming apart as the hydrogen bonds break).",
        "If they ask whether it is something to do with DNA polymerase, that is an understanding question: do not confirm the answer. Say something like: Yes it is, think about what the polymerase is doing, and what affects melting temperature.",
      ],
    },
    {
      id: "how-many-cycles",
      ask: "Now a change of pace. Have a look at this situation on the diagram. Can you work out how many cycles of PCR we would need?",
      points: [
        { id: "doubling", text: "each cycle doubles the number of molecules (2 to the n)" },
        {
          id: "set-up",
          text: "sets up 40 times 2 to the n reaching a billion, or 2 to the n reaching about 25 million",
        },
        { id: "answer-25", text: "about 25 cycles (24 or 25 accepted with sound working)" },
      ],
      hints: [
        "What happens to the number of molecules after one cycle? And after two?",
        "So after n cycles you have 40 times 2 to the n. How big does 2 to the n need to be?",
        "2 to the 10 is about a thousand. How many lots of 10 doublings get you to a billion?",
      ],
      answer:
        "Each cycle doubles the DNA, so we need 40 times 2 to the n to reach a billion, which means 2 to the n of about 25 million. 2 to the 24 is about 17 million and 2 to the 25 about 34 million, so 25 cycles.",
      rules: [
        "If they ask whether the starting molecules are identical, say: Let's assume that for now.",
        "If they are stuck on one part of the working, give a small prompt for just that part, then hand it back.",
        "Let them work aloud; do not do the arithmetic for them.",
      ],
      diagram: {
        id: "bio-pcr-2",
        svg: flowSvg([
          ["Start", ["40 identical", "DNA molecules"]],
          ["PCR", ["how many", "cycles?"]],
          ["Needed", ["at least", "1,000,000,000", "copies"]],
        ]),
        alt: "Three boxes joined by arrows. Start: 40 identical DNA molecules. PCR: how many cycles? Needed: at least 1,000,000,000 copies.",
        shows:
          "Three boxes: start with 40 identical DNA molecules; PCR, how many cycles?; needed: at least 1,000,000,000 copies.",
      },
    },
    {
      id: "different-strands",
      ask: "Good, but we've made a bit of a false assumption, haven't we? We assumed all 40 strands were identical, which is very unlikely. Say they are 40 different ones and we want to sequence just one of them. Without any further calculation, how many rounds of PCR do we now need?",
      points: [
        {
          id: "reuse",
          text: "only need to get the one strand up to 40 copies, then the earlier result applies",
        },
        {
          id: "six-more",
          text: "that takes 6 more rounds (2 to the 6 is 64), so about 31 in all",
        },
      ],
      hints: [
        "We don't need a full recalculation, do we? We need to end at the same number; we've just started lower.",
        "How can we get from that lower number back up to our old starting number?",
        "How many doublings take a single molecule past 40?",
      ],
      answer:
        "The one strand we want starts as a single copy. Six doublings take it past 40, since 2 to the 5 is 32 and 2 to the 6 is 64, and from there the 25 cycles from before apply. So 6 extra rounds, 31 in all.",
      rules: [
        "If they start a full recalculation, stop them and remind them this can be done in their head.",
        "If their answer is wrong, ask them to have another go before giving a hint.",
      ],
    },
  ],
  closing:
    "Say: Okay, let's leave things there for the day. Then give two specific strengths and one thing to work on, each tied to something they said, and close warmly.",
  // Approved by the owner on 23 Nov 2026 for all students, before Tim's check and a voice test.
  reviewedBy: "solly",
  reviewedAt: "2026-11-23",
};

export default scenario;

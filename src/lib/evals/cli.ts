// Runs the scripted-student evals against the real tutor prompts through the Lovable AI gateway.
//
//   LOVABLE_API_KEY=... bun run evals                 all tutors and all ten students
//   bun run evals --tutor=geography --students=strong,stuck --exchanges=4
//   bun run evals --dry-run                           canned replies, no key or network needed
//
// Writes eval-results/<timestamp>.json and .md, and compares with the latest earlier report.
// Exits 1 when a threshold is missed, the judge fails a commitment, or a measure regressed.
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PEDAGOGY_VERSION } from "@/content/index";
import { openingInstructions } from "@/lib/interview-briefing";
import { conversationInstructions } from "@/lib/live-relay.server";
import { BACKEND_MODEL, FEEDBACK_MODEL, LIVE_MODEL } from "@/lib/models";
import { buildPpeSession } from "@/lib/ppe.server";
import { COMMITMENTS } from "./judge";
import {
  runEvals,
  summariseReport,
  type ChatFn,
  type EvalReport,
  type TutorUnderTest,
} from "./runner";
import { SCRIPTED_STUDENTS } from "./scripted-students";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}
const dryRun = process.argv.includes("--dry-run");

function gatewayChat(model: string, key: string): ChatFn {
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  return async ({ system, messages }) => {
    const { text } = await generateText({
      model: provider.responses(model),
      system,
      messages,
      maxRetries: 1,
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low" } },
    });
    return text;
  };
}

/** Canned replies so the whole pipeline can be checked without a key. */
function dryRunChats(): { tutor: ChatFn; student: ChatFn; judge: ChatFn } {
  let tutorTurn = 0;
  const tutorLines = [
    "Who do you think owns a footpath across a farmer's field?",
    "Why does paying for the land settle it?",
    "What would change if the path had been walked for three hundred years?",
  ];
  return {
    tutor: async () => tutorLines[tutorTurn++ % tutorLines.length]!,
    student: async () => "I think whoever paid for it, because buying something makes it yours.",
    judge: async () =>
      JSON.stringify({
        commitments: COMMITMENTS.map(({ id }) => ({
          id,
          verdict: "not_applicable",
          evidenceTurns: [],
          note: "dry run",
        })),
        expectedBehaviour: [],
      }),
  };
}

async function tutorsUnderTest(choice: string): Promise<TutorUnderTest[]> {
  const tutors: TutorUnderTest[] = [];
  if (choice === "all" || choice === "geography") {
    tutors.push({
      id: "geography",
      instructions: conversationInstructions,
      opening: openingInstructions(1),
      versions: { tutorVersion: "fixed-briefing", pedagogyVersion: PEDAGOGY_VERSION },
    });
  }
  if (choice === "all" || choice === "ppe") {
    // Students only ever hear approved PPE cards, so that is what is tested.
    const session = await buildPpeSession({ openingTurn: 1 }, { includeDrafts: false });
    tutors.push({
      id: "ppe",
      instructions: session.liveInstructions,
      opening: session.opening,
      versions: {
        tutorVersion: session.tutorVersion,
        pedagogyVersion: session.pedagogyVersion,
        promptHash: session.promptHash,
        cardIds: session.cardIds.join(","),
      },
    });
  }
  if (!tutors.length) throw new Error(`Unknown --tutor=${choice}; use geography, ppe or all.`);
  return tutors;
}

async function latestReport(directory: string): Promise<EvalReport | undefined> {
  try {
    const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
    const last = files.at(-1);
    return last
      ? (JSON.parse(await readFile(path.join(directory, last), "utf8")) as EvalReport)
      : undefined;
  } catch {
    return undefined;
  }
}

async function main() {
  const outDir = option("out") ?? "eval-results";
  const exchanges = Number(option("exchanges") ?? 6);
  const wanted = option("students")?.split(",").filter(Boolean);
  const students = wanted
    ? SCRIPTED_STUDENTS.filter(({ id }) => wanted.includes(id))
    : SCRIPTED_STUDENTS;
  const unknown = wanted?.filter((id) => !SCRIPTED_STUDENTS.some((student) => student.id === id));
  if (unknown?.length || !students.length) {
    throw new Error(
      `Unknown --students: ${unknown?.join(", ") || "(none)"}. Choose from: ${SCRIPTED_STUDENTS.map(({ id }) => id).join(", ")}.`,
    );
  }
  const key = process.env["LOVABLE_API_KEY"];
  if (!dryRun && !key) {
    throw new Error("Set LOVABLE_API_KEY, or use --dry-run to check the pipeline without it.");
  }
  const fake = dryRun ? dryRunChats() : undefined;
  // The voice model cannot run in text, so the backend text model stands in for it.
  const models = dryRun
    ? { tutor: "dry-run", student: "dry-run", judge: "dry-run" }
    : {
        tutor: `${BACKEND_MODEL} (text stand-in for ${LIVE_MODEL})`,
        student: BACKEND_MODEL,
        judge: FEEDBACK_MODEL,
      };
  const report = await runEvals({
    tutors: await tutorsUnderTest(option("tutor") ?? "all"),
    students,
    exchanges: Number.isFinite(exchanges) && exchanges > 0 ? exchanges : 6,
    tutorChat: fake?.tutor ?? gatewayChat(BACKEND_MODEL, key!),
    studentChat: fake?.student ?? gatewayChat(BACKEND_MODEL, key!),
    judge: fake?.judge ?? gatewayChat(FEEDBACK_MODEL, key!),
    models,
    previous: dryRun ? undefined : await latestReport(outDir),
    onProgress: (message) => process.stderr.write(`running ${message}\n`),
  });
  const summary = summariseReport(report);
  if (!dryRun) {
    await mkdir(outDir, { recursive: true });
    const stamp = report.createdAt.replace(/[:.]/g, "-");
    await writeFile(path.join(outDir, `${stamp}.json`), JSON.stringify(report, null, 2));
    await writeFile(path.join(outDir, `${stamp}.md`), `${summary}\n`);
  }
  process.stdout.write(`${summary}\n`);
  // A dry run only checks the pipeline works; its canned replies are not meant to pass.
  process.exitCode = dryRun || report.passed ? 0 : 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
});

import type { Turn } from "./types";

const USER_LABELS = ["you", "student", "candidate"];
const DEFAULT_TUTOR_LABELS = ["dr river", "tutor", "interviewer", "assistant"];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parses the plain-text transcript the app produces today: blocks of
 * "You: ..." and "Dr River: ..." separated by blank lines. Text that follows a
 * block with no speaker label is treated as a continuation of the previous turn.
 * Turns are numbered from 1. Never throws.
 */
export function parseTranscript(text: string, tutorName?: string): Turn[] {
  if (typeof text !== "string" || !text.trim()) return [];
  const tutorLabels = [...DEFAULT_TUTOR_LABELS];
  if (typeof tutorName === "string" && tutorName.trim()) tutorLabels.push(tutorName.trim().toLowerCase());
  const labels = [...USER_LABELS, ...tutorLabels].map(escapeRegExp).sort((a, b) => b.length - a.length);
  const labelRe = new RegExp(`^\\s*(${labels.join("|")})\\s*:\\s*([\\s\\S]*)$`, "i");

  const turns: Turn[] = [];
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const m = labelRe.exec(trimmed);
    if (m) {
      const speaker = (m[1] ?? "").toLowerCase();
      const body = (m[2] ?? "").replace(/\s+/g, " ").trim();
      turns.push({ turn: turns.length + 1, role: USER_LABELS.includes(speaker) ? "user" : "assistant", text: body });
    } else if (turns.length > 0) {
      const last = turns[turns.length - 1]!;
      last.text = `${last.text} ${trimmed.replace(/\s+/g, " ")}`.trim();
    }
    // Unlabelled text before any speaker is ignored.
  }
  return turns;
}

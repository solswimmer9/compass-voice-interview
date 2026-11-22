// Roadmap scenarios: science interviews worked through as a fixed run of steps. Server-only.
// How to write one: README.md in this folder. Students only ever get approved scenarios; drafts
// are for tester accounts (PREVIEW_TESTER_EMAILS), passed in as includeDrafts by the server.
import type { Scenario, TutorId } from "../types.ts";
import pcr from "./pcr.ts";

export const SCENARIOS: readonly Scenario[] = [pcr];

export type ScenarioAccess = {
  /** Testers only. Students must never be given draft scenarios. */
  includeDrafts?: boolean;
};

/** Scenarios for a tutor. Approved only unless includeDrafts is true. */
export function scenariosFor(tutorId: TutorId, access: ScenarioAccess = {}): Scenario[] {
  return SCENARIOS.filter(
    (s) => s.tutor === tutorId && (s.status === "approved" || access.includeDrafts === true),
  );
}

/** Picks one usable scenario, rotating by seed. Undefined when there is none. */
export function selectScenario(
  tutorId: TutorId,
  access: ScenarioAccess & { seed?: number } = {},
): Scenario | undefined {
  const list = scenariosFor(tutorId, access);
  if (!list.length) return undefined;
  const seed = Number.isInteger(access.seed) ? Math.abs(access.seed ?? 0) : 0;
  return list[seed % list.length];
}

/** Looks a scenario up for feedback: only if usable under this access. */
export function usableScenarioById(
  id: unknown,
  tutorId: TutorId,
  access: ScenarioAccess = {},
): Scenario | undefined {
  return scenariosFor(tutorId, access).find((s) => s.id === id);
}

/** Every problem with a scenario, as readable messages. Empty means it is fine. */
export function scenarioProblems(scenario: Scenario): string[] {
  const problems: string[] = [];
  const where = (step: string) => `${scenario.id} / ${step}`;
  if (!/^[a-z0-9-]+$/.test(scenario.id)) problems.push(`${scenario.id}: id must be kebab-case`);
  if (!scenario.steps.length) problems.push(`${scenario.id}: needs at least one step`);
  if (!scenario.knowledge.trim()) problems.push(`${scenario.id}: knowledge is empty`);
  if (!scenario.closing.trim()) problems.push(`${scenario.id}: closing is empty`);
  if (
    scenario.status === "approved" &&
    (!scenario.reviewedBy || !/^\d{4}-\d{2}-\d{2}$/.test(scenario.reviewedAt))
  )
    problems.push(`${scenario.id}: approved scenarios need reviewedBy and reviewedAt (YYYY-MM-DD)`);
  const stepIds = new Set<string>();
  const pointIds = new Set<string>();
  for (const step of scenario.steps) {
    if (stepIds.has(step.id)) problems.push(`${where(step.id)}: duplicate step id`);
    stepIds.add(step.id);
    if (!step.ask.trim()) problems.push(`${where(step.id)}: ask is empty`);
    if (!step.points.length) problems.push(`${where(step.id)}: needs at least one point`);
    if (step.hints.length > 3) problems.push(`${where(step.id)}: at most 3 hints`);
    if (!step.answer.trim()) problems.push(`${where(step.id)}: answer is empty`);
    for (const point of step.points) {
      if (pointIds.has(point.id))
        problems.push(`${where(step.id)}: duplicate point id ${point.id}`);
      pointIds.add(point.id);
    }
    if (step.diagram && !step.diagram.svg.startsWith("<svg"))
      problems.push(`${where(step.id)}: diagram svg must start with <svg`);
  }
  return problems;
}

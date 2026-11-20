/**
 * Decisions the interview room makes at the two ends of a call. Kept free of React so they can be
 * tested; `src/routes/interview.tsx` is the only caller. Access is still enforced on the server
 * (`live-relay.server.ts`), so these only choose which screen to show.
 */

export type AutoStartAction = "wait" | "sign-in" | "out-of-credits" | "start";

/** What "Start interview" (start=true) should do once the account has loaded. */
export function autoStartAction(args: {
  accountLoading: boolean;
  signedIn: boolean;
  /** Interviews left, or undefined when the account data has not arrived. */
  totalRemaining: number | undefined;
  /** Browser-only preview hint: shows the room instead of the paywall, never grants access. */
  previewBrowser: boolean;
}): AutoStartAction {
  if (args.accountLoading) return "wait";
  if (!args.signedIn) return "sign-in";
  if (!args.previewBrowser && args.totalRemaining === 0) return "out-of-credits";
  return "start";
}

/** True when a finished call should save its transcript and go to the feedback letter. */
export function shouldHandOffToFeedback(args: {
  callStatus: string;
  alreadyHandedOff: boolean;
  startedHere: boolean;
  lineCount: number;
  interviewId: string | null | undefined;
}): boolean {
  if (args.callStatus !== "closed" || args.alreadyHandedOff || !args.startedHere) return false;
  return args.lineCount > 0 && Boolean(args.interviewId);
}

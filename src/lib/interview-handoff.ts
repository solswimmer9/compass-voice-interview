/**
 * Decisions the interview room makes at the two ends of a call. Kept free of React so they can be
 * tested; `src/routes/interview.tsx` is the only caller. Access is still enforced on the server
 * (`live-relay.server.ts`, and the database for guest tries), so these only choose which screen
 * to show.
 */

export type AutoStartAction = "wait" | "sign-in" | "out-of-interviews" | "start";

/** What "Start interview" (start=true) should do once the account has loaded. */
export function autoStartAction(args: {
  accountLoading: boolean;
  /** A guest who has used their free tries: must sign in. */
  guestUsedUp: boolean;
  /** Not a tester and no interviews left: must buy more. */
  outOfInterviews: boolean;
  /** Browser-only preview hint: shows the room instead of the paywall, never grants access. */
  previewBrowser: boolean;
}): AutoStartAction {
  if (args.accountLoading) return "wait";
  if (args.guestUsedUp) return "sign-in";
  if (args.outOfInterviews && !args.previewBrowser) return "out-of-interviews";
  return "start";
}

/** True when a finished call should save its transcript and go to the feedback letter. */
export function shouldHandOffToFeedback(args: {
  callStatus: string;
  alreadyHandedOff: boolean;
  startedHere: boolean;
  /** A dropped call waits for the student to reconnect or decline. */
  canReconnect: boolean;
  lineCount: number;
  interviewId: string | null | undefined;
}): boolean {
  if (args.callStatus !== "closed" || args.alreadyHandedOff || !args.startedHere) return false;
  if (args.canReconnect) return false;
  return args.lineCount > 0 && Boolean(args.interviewId);
}

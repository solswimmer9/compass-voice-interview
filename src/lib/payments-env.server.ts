// Decides on the server which payment environment ("sandbox" test cards or "live" money) a
// request may use. The browser still sends the environment it expects, but it is only checked
// against this answer, never trusted: otherwise anyone on the published site could ask for
// "sandbox", pay with a Stripe test card and get real interviews.
//
// Order of precedence:
// 1. The PAYMENTS_ENV secret, if set to "sandbox" or "live". Lovable secrets may be shared by
//    the preview and the published site, so only set this when one environment is wanted for
//    both (for example "live" once preview checkout testing is no longer needed).
// 2. The payments client token baked into this build (VITE_PAYMENTS_CLIENT_TOKEN, from
//    .env.development for the Lovable preview and .env.production for the published site).
//    It is fixed when the app is built, so a visitor cannot change it, and it is the same
//    value the browser uses to load Stripe, so server and browser agree.
// 3. Otherwise "live", the safe default: a misconfigured server never accepts test payments.
//
// This only picks where payments and allowances are recorded. It never grants free access;
// unlimited testing stays with the PREVIEW_TESTER_EMAILS check in testers.ts.

export type PaymentsEnv = "sandbox" | "live";

export class PaymentsEnvironmentError extends Error {
  constructor() {
    super("Payments are set up differently on this site. Please refresh the page and try again.");
    this.name = "PaymentsEnvironmentError";
  }
}

type Sources = { override?: string | undefined; clientToken?: string | undefined };

function readSources(): Sources {
  return {
    override: typeof process !== "undefined" ? process.env["PAYMENTS_ENV"] : undefined,
    // Written exactly like this so the build replaces it with the baked-in value.
    clientToken: import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined,
  };
}

export function serverPaymentsEnvironment(sources: Sources = readSources()): PaymentsEnv {
  const override = sources.override?.trim().toLowerCase();
  if (override === "sandbox" || override === "live") return override;
  if (sources.clientToken?.startsWith("pk_test_")) return "sandbox";
  return "live";
}

/**
 * Returns the environment this server allows. If the browser said which one it expected and it
 * differs, throws PaymentsEnvironmentError rather than silently switching.
 */
export function resolvePaymentsEnvironment(
  requested?: unknown,
  sources: Sources = readSources(),
): PaymentsEnv {
  const allowed = serverPaymentsEnvironment(sources);
  if (requested !== undefined && requested !== null && requested !== allowed) {
    throw new PaymentsEnvironmentError();
  }
  return allowed;
}

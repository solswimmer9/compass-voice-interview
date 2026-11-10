// Unlimited testing (no purchase, no feedback limit) is granted per signed-in account,
// never by web address. The server cannot trust its own request URL on the published
// site, so a hostname check there let anyone skip the paywall.
//
// Set PREVIEW_TESTER_EMAILS in Lovable Cloud secrets to a comma-separated list of
// emails. If it is unset, nobody gets unlimited testing.

export function parseTesterEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isTesterEmail(email: unknown, allowList: string | undefined): boolean {
  if (typeof email !== "string" || !email) return false;
  return parseTesterEmails(allowList).has(email.trim().toLowerCase());
}

export function isServerTester(email: unknown): boolean {
  return isTesterEmail(email, process.env["PREVIEW_TESTER_EMAILS"]);
}

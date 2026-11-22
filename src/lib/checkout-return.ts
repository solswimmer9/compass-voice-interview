/** Where Stripe sends the buyer after paying. Only this page, only on our own origin. */
export const CHECKOUT_RETURN_PATH = "/checkout/success";

/**
 * Accepts a Stripe return URL only when it is http(s), points at the checkout confirmation page,
 * and, when the browser sent an `Origin` header, is on that same origin. The header is the page
 * the buyer is on; the server's own URL is not used because the published site is served from
 * internal hostnames. Anything else is refused, so a crafted request cannot send a buyer to
 * another site after payment.
 */
export function isValidCheckoutReturnUrl(
  returnUrl: string,
  requestOrigin: string | null | undefined,
): boolean {
  let url: URL;
  try {
    url = new URL(returnUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (requestOrigin && url.origin !== requestOrigin) return false;
  return url.pathname === CHECKOUT_RETURN_PATH && url.hash === "";
}

/** A Stripe session id as it appears in the success link; anything else is dropped. */
export function parseCheckoutSessionId(value: unknown): string | undefined {
  return typeof value === "string" && /^cs_[A-Za-z0-9_]+$/.test(value) ? value : undefined;
}

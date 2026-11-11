import Stripe from "stripe";
const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = "sandbox" | "live";

const GATEWAY_STRIPE_BASE = "https://connector-gateway.lovable.dev/stripe";

export function getConnectionApiKey(env: StripeEnv): string {
  return env === "sandbox" ? getEnv("STRIPE_SANDBOX_API_KEY") : getEnv("STRIPE_LIVE_API_KEY");
}

export function createStripeClient(env: StripeEnv): Stripe {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = getEnv("LOVABLE_API_KEY");
  return new Stripe(connectionApiKey, {
    apiVersion: "2026-03-25.dahlia",
    httpClient: Stripe.createFetchHttpClient((input, init) => {
      const stripeUrl = input instanceof Request ? input.url : input.toString();
      const gatewayUrl = stripeUrl.replace("https://api.stripe.com", GATEWAY_STRIPE_BASE);
      return fetch(gatewayUrl, {
        ...init,
        headers: {
          ...Object.fromEntries(
            new Headers(
              init?.headers ?? (input instanceof Request ? input.headers : undefined),
            ).entries(),
          ),
          "X-Connection-Api-Key": connectionApiKey,
          "Lovable-API-Key": lovableApiKey,
        },
      });
    }),
  });
}

export function getStripeErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as {
      message?: string;
      type?: string;
      code?: string;
      decline_code?: string;
      param?: string;
      requestId?: string;
      raw?: {
        message?: string;
        type?: string;
        code?: string;
        decline_code?: string;
        param?: string;
        requestId?: string;
      };
    };
    const message = e.raw?.message ?? e.message;
    if (message) {
      const details = [
        e.raw?.type ?? e.type,
        e.raw?.code ?? e.code,
        e.raw?.decline_code ?? e.decline_code,
        e.raw?.param ?? e.param,
        e.raw?.requestId ?? e.requestId,
      ].filter(Boolean);
      return details.length ? `${message} (${details.join(", ")})` : message;
    }
  }
  return "Stripe request failed";
}

export async function verifyWebhook(
  req: Request,
  env: StripeEnv,
): Promise<{ type: string; data: { object: unknown } }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret =
    env === "sandbox"
      ? getEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
      : getEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");
  if (!signature || !body) throw new Error("Missing signature or body");
  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1" && value) v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature format");
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300)
    throw new Error("Webhook timestamp too old");
  // crypto.subtle.verify compares the HMAC in constant time, so response timing reveals
  // nothing about how much of a forged signature was right.
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const payload = new TextEncoder().encode(`${timestamp}.${body}`);
  let valid = false;
  for (const candidate of v1Signatures) {
    const bytes = hexToBytes(candidate);
    if (bytes && (await crypto.subtle.verify("HMAC", key, bytes, payload))) valid = true;
  }
  if (!valid) throw new Error("Invalid webhook signature");
  return JSON.parse(body) as { type: string; data: { object: unknown } };
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length !== 64 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/**
 * The absolute Stripe return URL for a browser-supplied return path, or null if it is not a
 * path on this site's checkout pages. Accepts "/checkout/success?..." or the same URL with the
 * page's own origin; anything pointing elsewhere is refused so checkout cannot be used to send
 * people to another website.
 */
export function checkoutReturnUrl(
  returnUrl: unknown,
  origin: string | null | undefined,
): string | null {
  if (typeof returnUrl !== "string" || !origin || returnUrl.length > 500) return null;
  let base: URL;
  try {
    base = new URL(origin);
  } catch {
    return null;
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") return null;
  if (base.protocol === "http:" && base.hostname !== "localhost" && base.hostname !== "127.0.0.1")
    return null;
  if (/[\\\s]/.test(returnUrl)) return null;
  const isPath = returnUrl.startsWith("/") && !returnUrl.startsWith("//");
  if (!isPath && !returnUrl.startsWith(`${base.origin}/`)) return null;
  let url: URL;
  try {
    url = new URL(returnUrl, base.origin);
  } catch {
    return null;
  }
  if (url.origin !== base.origin || !url.pathname.startsWith("/checkout/")) return null;
  // Stripe fills in {CHECKOUT_SESSION_ID}; keep the braces readable rather than percent-encoded.
  return `${url.origin}${url.pathname}${url.search.replace(/%7B/gi, "{").replace(/%7D/gi, "}")}`;
}

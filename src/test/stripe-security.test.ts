import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkoutReturnUrl, verifyWebhook } from "@/lib/stripe.server";

const ORIGIN = "https://compass-voice-interview.lovable.app";
const SUCCESS = "/checkout/success?session_id={CHECKOUT_SESSION_ID}";

describe("checkout return address", () => {
  it("accepts a checkout path on this site", () => {
    expect(checkoutReturnUrl(SUCCESS, ORIGIN)).toBe(`${ORIGIN}${SUCCESS}`);
    expect(checkoutReturnUrl(`${ORIGIN}${SUCCESS}`, ORIGIN)).toBe(`${ORIGIN}${SUCCESS}`);
    expect(checkoutReturnUrl("/checkout/success", "http://localhost:8080")).toBe(
      "http://localhost:8080/checkout/success",
    );
  });

  it("refuses other websites and tricks that lead to them", () => {
    for (const bad of [
      "https://evil.example/checkout/success",
      "//evil.example/checkout/success",
      "/\\evil.example/checkout/success",
      "\\\\evil.example/checkout/success",
      `${ORIGIN}.evil.example/checkout/success`,
      `${ORIGIN}@evil.example/checkout/success`,
      "javascript:alert(1)",
      "checkout/success",
      "/checkout/../account",
      "/account",
      "/ checkout/success",
      "",
    ]) {
      expect(checkoutReturnUrl(bad, ORIGIN), bad).toBeNull();
    }
  });

  it("refuses when the page origin is missing or unusual", () => {
    expect(checkoutReturnUrl(SUCCESS, null)).toBeNull();
    expect(checkoutReturnUrl(SUCCESS, "not a url")).toBeNull();
    expect(checkoutReturnUrl(SUCCESS, "http://compass.example")).toBeNull();
    expect(checkoutReturnUrl(SUCCESS, "ftp://compass.example")).toBeNull();
    expect(checkoutReturnUrl(42, ORIGIN)).toBeNull();
  });
});

async function sign(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(mac), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function webhook(signature: string, body: string) {
  return new Request("https://example.test/api/public/payments/webhook?env=sandbox", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body,
  });
}

describe("payment webhook signature", () => {
  const secret = "whsec_test_secret";
  const body = JSON.stringify({
    type: "checkout.session.completed",
    data: { object: { id: "cs_1" } },
  });
  beforeEach(() => vi.stubEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET", secret));
  afterEach(() => vi.unstubAllEnvs());

  it("accepts a correctly signed event", async () => {
    const t = Math.floor(Date.now() / 1000);
    const v1 = await sign(secret, `${t}.${body}`);
    const event = await verifyWebhook(webhook(`t=${t},v1=${v1}`, body), "sandbox");
    expect(event.type).toBe("checkout.session.completed");
  });

  it("accepts when any one of several signatures matches (secret rotation)", async () => {
    const t = Math.floor(Date.now() / 1000);
    const good = await sign(secret, `${t}.${body}`);
    const other = await sign("whsec_old", `${t}.${body}`);
    await expect(
      verifyWebhook(webhook(`t=${t},v1=${other},v1=${good}`, body), "sandbox"),
    ).resolves.toBeTruthy();
  });

  it("rejects wrong, altered, short and malformed signatures", async () => {
    const t = Math.floor(Date.now() / 1000);
    const good = await sign(secret, `${t}.${body}`);
    const flipped = `${good.slice(0, -1)}${good.endsWith("0") ? "1" : "0"}`;
    for (const v1 of [
      await sign("whsec_wrong", `${t}.${body}`),
      flipped,
      good.slice(0, 32),
      `${good}00`,
      "z".repeat(64),
    ]) {
      await expect(verifyWebhook(webhook(`t=${t},v1=${v1}`, body), "sandbox"), v1).rejects.toThrow(
        "Invalid webhook signature",
      );
    }
    await expect(
      verifyWebhook(webhook(`t=${t},v1=${good}`, body.replace("cs_1", "cs_2")), "sandbox"),
    ).rejects.toThrow("Invalid webhook signature");
  });

  it("rejects old timestamps and missing parts", async () => {
    const t = Math.floor(Date.now() / 1000) - 600;
    const v1 = await sign(secret, `${t}.${body}`);
    await expect(verifyWebhook(webhook(`t=${t},v1=${v1}`, body), "sandbox")).rejects.toThrow(
      "too old",
    );
    await expect(verifyWebhook(webhook(`v1=${v1}`, body), "sandbox")).rejects.toThrow(
      "Invalid signature format",
    );
  });
});

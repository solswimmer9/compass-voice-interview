import { describe, expect, it } from "vitest";
import { isValidCheckoutReturnUrl, parseCheckoutSessionId } from "@/lib/checkout-return";

const OK = "https://app.example.com/checkout/success?session_id={CHECKOUT_SESSION_ID}";

describe("checkout return URL", () => {
  it("accepts the confirmation page on the page's own origin", () => {
    expect(isValidCheckoutReturnUrl(OK, "https://app.example.com")).toBe(true);
  });
  it("accepts it when the browser sent no Origin header", () => {
    expect(isValidCheckoutReturnUrl(OK, null)).toBe(true);
  });
  it("refuses another origin", () => {
    expect(isValidCheckoutReturnUrl(OK, "https://other.example.com")).toBe(false);
    expect(
      isValidCheckoutReturnUrl("https://evil.test/checkout/success", "https://app.example.com"),
    ).toBe(false);
  });
  it("refuses any other page, a fragment, a non-http scheme or garbage", () => {
    expect(isValidCheckoutReturnUrl("https://app.example.com/account", null)).toBe(false);
    expect(isValidCheckoutReturnUrl("https://app.example.com/checkout/success#x", null)).toBe(
      false,
    );
    expect(isValidCheckoutReturnUrl("javascript:alert(1)", null)).toBe(false);
    expect(isValidCheckoutReturnUrl("not a url", null)).toBe(false);
  });
});

describe("checkout session id", () => {
  it("keeps Stripe session ids and drops everything else", () => {
    expect(parseCheckoutSessionId("cs_test_a1B2")).toBe("cs_test_a1B2");
    expect(parseCheckoutSessionId("https://evil.test")).toBeUndefined();
    expect(parseCheckoutSessionId(42)).toBeUndefined();
  });
});

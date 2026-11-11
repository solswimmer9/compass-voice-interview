import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PaymentsEnvironmentError,
  resolvePaymentsEnvironment,
  serverPaymentsEnvironment,
} from "@/lib/payments-env.server";

describe("server payment environment", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("follows the payments token built into this site", () => {
    expect(serverPaymentsEnvironment({ clientToken: "pk_test_abc" })).toBe("sandbox");
    expect(serverPaymentsEnvironment({ clientToken: "pk_live_abc" })).toBe("live");
  });

  it("defaults to live so a misconfigured server never accepts test payments", () => {
    expect(serverPaymentsEnvironment({})).toBe("live");
    expect(serverPaymentsEnvironment({ clientToken: "" })).toBe("live");
    expect(serverPaymentsEnvironment({ clientToken: "nonsense" })).toBe("live");
  });

  it("lets the PAYMENTS_ENV secret decide when it is set", () => {
    expect(serverPaymentsEnvironment({ override: "live", clientToken: "pk_test_abc" })).toBe(
      "live",
    );
    expect(serverPaymentsEnvironment({ override: " Sandbox ", clientToken: "pk_live_abc" })).toBe(
      "sandbox",
    );
    expect(serverPaymentsEnvironment({ override: "other", clientToken: "pk_test_abc" })).toBe(
      "sandbox",
    );
  });

  it("refuses a browser asking for sandbox on the live site", () => {
    const live = { clientToken: "pk_live_abc" };
    expect(resolvePaymentsEnvironment("live", live)).toBe("live");
    expect(resolvePaymentsEnvironment(undefined, live)).toBe("live");
    expect(() => resolvePaymentsEnvironment("sandbox", live)).toThrow(PaymentsEnvironmentError);
    expect(() => resolvePaymentsEnvironment("anything", live)).toThrow(PaymentsEnvironmentError);
  });

  it("still lets the preview use sandbox", () => {
    const preview = { clientToken: "pk_test_abc" };
    expect(resolvePaymentsEnvironment("sandbox", preview)).toBe("sandbox");
    expect(() => resolvePaymentsEnvironment("live", preview)).toThrow(PaymentsEnvironmentError);
  });

  it("reads the real settings by default", () => {
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "pk_test_abc");
    vi.stubEnv("PAYMENTS_ENV", "");
    expect(serverPaymentsEnvironment()).toBe("sandbox");
    vi.stubEnv("PAYMENTS_ENV", "live");
    expect(serverPaymentsEnvironment()).toBe("live");
    expect(() => resolvePaymentsEnvironment("sandbox")).toThrow(PaymentsEnvironmentError);
  });
});

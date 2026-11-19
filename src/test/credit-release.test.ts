// Giving back the credit of a call that failed to start. The server-only database function is
// tried first; until Lovable has applied it, the old signed-in call is the fallback.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adminRpc = vi.fn();
vi.mock("../integrations/supabase/client.server.ts", () => ({ supabaseAdmin: { rpc: adminRpc } }));

const CREDIT = {
  id: "11111111-1111-1111-1111-111111111111",
  userId: "22222222-2222-2222-2222-222222222222",
};

function signedInClient(error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data: true, error });
  return { rpc, supabase: { rpc } as never };
}

describe("releaseInterviewCredit", () => {
  beforeEach(() => {
    adminRpc.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("uses the server-only function, with the user named by the server", async () => {
    const { releaseInterviewCredit } = await import("@/lib/live-relay.server");
    adminRpc.mockResolvedValue({ data: true, error: null });
    const user = signedInClient();
    expect(await releaseInterviewCredit({ ...CREDIT, supabase: user.supabase })).toBeNull();
    expect(adminRpc).toHaveBeenCalledWith("release_interview_credit", {
      p_interview_id: CREDIT.id,
      p_user_id: CREDIT.userId,
    });
    expect(user.rpc).not.toHaveBeenCalled();
  });

  it("falls back to the signed-in call before the database change, without a warning", async () => {
    const { releaseInterviewCredit } = await import("@/lib/live-relay.server");
    adminRpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "not found" } });
    const user = signedInClient();
    expect(await releaseInterviewCredit({ ...CREDIT, supabase: user.supabase })).toBeNull();
    expect(user.rpc).toHaveBeenCalledWith("release_interview_credit", {
      p_interview_id: CREDIT.id,
    });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it.each([
    ["the server-only call fails", () => adminRpc.mockResolvedValue({ error: { code: "XX000" } })],
    [
      "the admin client cannot be created",
      () =>
        adminRpc.mockImplementation(() => {
          throw new Error("Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY");
        }),
    ],
  ])("warns and falls back when %s", async (_, arrange) => {
    const { releaseInterviewCredit } = await import("@/lib/live-relay.server");
    arrange();
    const user = signedInClient();
    await releaseInterviewCredit({ ...CREDIT, supabase: user.supabase });
    expect(user.rpc).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("reports the error when neither call works, e.g. after the old function is revoked", async () => {
    const { releaseInterviewCredit } = await import("@/lib/live-relay.server");
    adminRpc.mockResolvedValue({ error: { code: "XX000" } });
    const denied = { code: "42501", message: "permission denied" };
    const user = signedInClient(denied);
    expect(await releaseInterviewCredit({ ...CREDIT, supabase: user.supabase })).toEqual(denied);
  });
});

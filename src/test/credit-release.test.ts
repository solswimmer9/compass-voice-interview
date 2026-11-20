// Giving back the credit of a call that failed to start. Only the server-only database function
// is used; a student's own sign-in is never used to restore a credit.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adminRpc = vi.fn();
vi.mock("../integrations/supabase/client.server.ts", () => ({ supabaseAdmin: { rpc: adminRpc } }));

const CREDIT = {
  id: "11111111-1111-1111-1111-111111111111",
  userId: "22222222-2222-2222-2222-222222222222",
};

describe("releaseInterviewCredit", () => {
  beforeEach(() => adminRpc.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("uses the server-only function, with the user named by the server", async () => {
    const { releaseInterviewCredit } = await import("@/lib/live-relay.server");
    adminRpc.mockResolvedValue({ data: true, error: null });
    expect(await releaseInterviewCredit(CREDIT)).toBeNull();
    expect(adminRpc).toHaveBeenCalledTimes(1);
    expect(adminRpc).toHaveBeenCalledWith("release_interview_credit", {
      p_interview_id: CREDIT.id,
      p_user_id: CREDIT.userId,
    });
  });

  it("reports the error instead of falling back to the student's sign-in", async () => {
    const { releaseInterviewCredit } = await import("@/lib/live-relay.server");
    const denied = { code: "XX000", message: "failed" };
    adminRpc.mockResolvedValue({ error: denied });
    expect(await releaseInterviewCredit(CREDIT)).toEqual(denied);
    expect(adminRpc).toHaveBeenCalledTimes(1);
  });
});

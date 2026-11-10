import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useElevenLabsInterview } from "@/hooks/use-elevenlabs-interview";

const mocks = vi.hoisted(() => ({
  startSession: vi.fn(),
  endSession: vi.fn(),
  startInterviewSession: vi.fn(),
  startPreviewInterviewSession: vi.fn(),
  releaseInterviewCredit: vi.fn(),
}));

vi.mock("@elevenlabs/react", () => ({
  useConversation: () => ({
    startSession: mocks.startSession,
    endSession: mocks.endSession,
    isMuted: false,
    isSpeaking: false,
    setMuted: vi.fn(),
  }),
}));

vi.mock("@/lib/paddle", () => ({ getPaddleEnvironment: () => "live" }));
vi.mock("@/lib/preview", () => ({ isPreviewBrowser: () => false }));
vi.mock("@/utils/interview.functions", () => ({
  startInterviewSession: mocks.startInterviewSession,
  startPreviewInterviewSession: mocks.startPreviewInterviewSession,
  releaseInterviewCredit: mocks.releaseInterviewCredit,
}));

describe("ElevenLabs interview startup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores the exact interview credit when the voice connection fails", async () => {
    const interviewId = "04432c37-afd4-48d7-bf18-460f181d98b4";
    mocks.startInterviewSession.mockResolvedValue({
      interviewId,
      signedUrl: "wss://example.test/conversation",
      openingQuestion: "What does a map hide?",
    });
    mocks.startSession.mockRejectedValue(new Error("The AI agent you are trying to reach is not available."));
    mocks.releaseInterviewCredit.mockResolvedValue({ released: true });

    const { result } = renderHook(() => useElevenLabsInterview({ onEvent: vi.fn() }));
    await act(() => result.current.start());

    expect(mocks.startSession).toHaveBeenCalledOnce();
    expect(mocks.releaseInterviewCredit).toHaveBeenCalledWith({ data: { interviewId } });
    expect(result.current.status).toBe("closed");
    expect(result.current.error).toBe("The AI agent you are trying to reach is not available.");
  });
});

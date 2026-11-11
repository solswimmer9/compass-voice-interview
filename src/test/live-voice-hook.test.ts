import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HEARTBEAT_ACK_WINDOW_MS,
  MEDIA_RECOVERY_GRACE_MS,
  useLiveVoice,
} from "@/hooks/use-live-voice";

type Listener = (event: { data?: unknown; track?: unknown }) => void;

class FakeTarget {
  listeners = new Map<string, Listener[]>();
  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  removeEventListener(type: string, listener: Listener) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener),
    );
  }
  dispatch(type: string, event: { data?: unknown; track?: unknown } = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class FakeChannel extends FakeTarget {
  readyState = "open";
  close() {
    this.readyState = "closed";
  }
}

class FakePeer extends FakeTarget {
  static latest: FakePeer | undefined;
  connectionState = "connecting";
  iceGatheringState = "complete";
  localDescription: { sdp: string } | null = null;
  channel = new FakeChannel();
  constructor() {
    super();
    FakePeer.latest = this;
  }
  addTrack() {}
  createDataChannel() {
    return this.channel;
  }
  async createOffer() {
    return { type: "offer", sdp: "offer-sdp" };
  }
  async setLocalDescription(description: { sdp: string }) {
    this.localDescription = description;
  }
  async setRemoteDescription() {}
  close() {
    this.connectionState = "closed";
  }
  setState(state: string) {
    this.connectionState = state;
    this.dispatch("connectionstatechange");
  }
}

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = 1;
  sent: Array<Record<string, unknown>> = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.();
  }
  receive(event: object) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

const interviewId = "04432c37-afd4-48d7-bf18-460f181d98b4";

async function flush() {
  await act(async () => {
    for (let index = 0; index < 20; index++) await Promise.resolve();
  });
}

async function advance(ms: number, socket?: FakeWebSocket) {
  // Advance a second at a time, acknowledging heartbeats when a socket is given.
  for (let elapsed = 0; elapsed < ms; elapsed += 1000) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Math.min(1000, ms - elapsed));
    });
    if (socket) act(() => socket.receive({ type: "gateway.heartbeat.ack" }));
  }
}

function setup() {
  const hook = renderHook(() =>
    useLiveVoice({
      getStartContext: async () => ({ accessToken: "token", environment: "live" }),
    }),
  );
  (hook.result.current.audioRef as { current: HTMLAudioElement | null }).current =
    document.createElement("audio");
  return hook;
}

async function connect(hook: ReturnType<typeof setup>, launch?: () => void) {
  act(() => (launch ?? hook.result.current.start)());
  await flush();
  const socket = FakeWebSocket.instances.at(-1)!;
  const peer = FakePeer.latest!;
  act(() => socket.onopen?.());
  act(() => socket.receive({ type: "app.interview.started", interviewId }));
  peer.connectionState = "connected";
  act(() =>
    socket.receive({ type: "gateway.session.created", transport: { type: "webrtc", sdp: "a" } }),
  );
  await flush();
  return { socket, peer };
}

describe("live voice hook resilience", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    const track = { enabled: true, stop: vi.fn(), addEventListener: vi.fn() };
    vi.stubGlobal("RTCPeerConnection", FakePeer);
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal(
      "MediaStream",
      class {
        constructor(public tracks: unknown[]) {}
      },
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [track],
          getAudioTracks: () => [track],
        })),
      },
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rides out a brief media interruption instead of ending the call", async () => {
    const hook = setup();
    const { socket, peer } = await connect(hook);
    expect(hook.result.current.status).toBe("connected");

    act(() => peer.setState("disconnected"));
    await advance(MEDIA_RECOVERY_GRACE_MS - 3000, socket);
    expect(hook.result.current.status).toBe("connected");
    expect(hook.result.current.unstable).toBe(true);

    act(() => peer.setState("connected"));
    await advance(2000, socket);
    expect(hook.result.current.unstable).toBe(false);
    expect(hook.result.current.status).toBe("connected");
  });

  it("marks a call whose media never recovers as dropped, so it can be resumed", async () => {
    const hook = setup();
    const { socket, peer } = await connect(hook);

    act(() => peer.setState("disconnected"));
    await advance(MEDIA_RECOVERY_GRACE_MS + 1000, socket);
    act(() => socket.receive({ type: "session.closed" }));

    expect(hook.result.current.status).toBe("closed");
    expect(hook.result.current.ending).toBe("dropped");
    expect(hook.result.current.interviewId).toBe(interviewId);
  });

  it("waits the wider heartbeat window before treating the call as lost", async () => {
    const hook = setup();
    const { socket } = await connect(hook);

    await advance(HEARTBEAT_ACK_WINDOW_MS - 2000);
    expect(hook.result.current.status).toBe("connected");
    await advance(3000);
    act(() => socket.close());

    expect(hook.result.current.ending).toBe("dropped");
  });

  it("records a student-ended call as ended, not dropped", async () => {
    const hook = setup();
    const { socket } = await connect(hook);

    act(() => hook.result.current.stop());
    act(() => socket.receive({ type: "session.closed", usage: { seconds: 30 } }));

    expect(hook.result.current.ending).toBe("user");
    expect(hook.result.current.error).toBeNull();
  });

  it("ends normally with a friendly note when time is up", async () => {
    const hook = setup();
    const { socket } = await connect(hook);

    act(() => socket.receive({ type: "app.time_up", message: "Time's up." }));
    expect(socket.sent).toContainEqual({ type: "session.close" });
    act(() => socket.receive({ type: "session.closed", usage: { seconds: 1200 } }));

    expect(hook.result.current.ending).toBe("time_up");
    expect(hook.result.current.notice).toBe("Time's up.");
    expect(hook.result.current.error).toBeNull();
  });

  it("reconnects a dropped call with the interview id and recap", async () => {
    const hook = setup();
    const first = await connect(hook);
    act(() => first.socket.close());
    expect(hook.result.current.ending).toBe("dropped");

    const second = await connect(hook, () => hook.result.current.reconnect("You: rivers."));

    expect(second.socket).not.toBe(first.socket);
    expect(second.socket.sent[0]).toMatchObject({
      type: "app.start",
      resumeInterviewId: interviewId,
      recap: "You: rivers.",
    });
    expect(hook.result.current.status).toBe("connected");
    expect(hook.result.current.resumed).toBe(true);
  });

  it("does not offer reconnect for a call that never connected", async () => {
    const hook = setup();
    act(() => hook.result.current.start());
    await flush();
    const socket = FakeWebSocket.instances.at(-1)!;
    act(() => socket.onopen?.());
    act(() => socket.receive({ type: "app.error", error: { message: "No credits" } }));
    act(() => socket.close());

    expect(hook.result.current.ending).toBe("failed");
    act(() => hook.result.current.reconnect("You: hi"));
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});

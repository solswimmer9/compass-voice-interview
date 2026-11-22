import { useCallback, useEffect, useRef, useState } from "react";
import { microphoneErrorMessage } from "@/lib/mic-error";

/** Longest wait before the voice service is contacted (includes the microphone prompt). */
export const STARTUP_TIMEOUT_MS = 45_000;
export const STARTUP_TIMEOUT_MESSAGE =
  "The call didn't start in time. Check your microphone is allowed, then start again.";

export type LiveEvent = {
  type: string;
  reason?: string;
  error?: { message?: string };
  usage?: { seconds?: number };
  finalized?: boolean;
  transport?: { type?: string; sdp?: string };
  delta?: string;
  start_ms?: number;
  end_ms?: number;
  interviewId?: string;
  [key: string]: unknown;
};

/**
 * Why the last call ended. "dropped" means the call had connected and then the network,
 * media or voice service failed, so it can be resumed with reconnect(). "failed" means it
 * never got going.
 */
export type LiveEnding = "user" | "dropped" | "time_up" | "failed";

type LiveState = {
  status: "idle" | "connecting" | "connected" | "stopping" | "closed";
  error: string | null;
  hasConnected: boolean;
  finalized: boolean | null;
  muted: boolean;
  playbackBlocked: boolean;
  interviewId: string | null;
  ending: LiveEnding | null;
  /** A friendly, non-error note from the server, such as the time-up message. */
  notice: string | null;
  /** Local clock time when the server will end the interview. */
  endsAt: number | null;
  /** True while the media connection is briefly interrupted but may still recover. */
  unstable: boolean;
  /** True when the current or last call resumed an earlier interview. */
  resumed: boolean;
};

export type LiveStartContext = {
  accessToken: string;
  environment: "sandbox" | "live";
  /** Optional practice reading this interview opens on. */
  readingId?: string;
  /** "ppe" is Prof Matt, "biology" Dr Toby; omitted means geography (Dr River). */
  tutorId?: "ppe" | "biology";
  /** "object" opens with an unlabelled chart on the table. The server picks the object. */
  mode?: "object";
};

type LiveResume = { interviewId: string; recap: string };

const initialState: LiveState = {
  status: "idle",
  error: null,
  hasConnected: false,
  finalized: null,
  muted: false,
  playbackBlocked: false,
  interviewId: null,
  ending: null,
  notice: null,
  endsAt: null,
  unstable: false,
  resumed: false,
};

/** Missing heartbeat acknowledgements for this long end the call. */
export const HEARTBEAT_ACK_WINDOW_MS = 12_000;
/**
 * Microphone clean-up before audio reaches the tutor: echo and noise filtering, steady volume,
 * one channel, and voice isolation where the browser supports it (others ignore it), so room
 * noise is less likely to sound like the student speaking.
 */
export const MICROPHONE_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
  voiceIsolation: true,
} as MediaTrackConstraints;

/** How long an interrupted media connection may try to recover on its own. */
export const MEDIA_RECOVERY_GRACE_MS = 15_000;

export function useLiveVoice(options: {
  url?: string;
  getStartContext: () => Promise<LiveStartContext>;
  onEvent?: (event: LiveEvent) => void | Promise<void>;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const controller = useRef<ReturnType<typeof createLiveVoice> | null>(null);
  const mounted = useRef(false);
  const latest = useRef(options);
  const [call, setCall] = useState(initialState);
  const callRef = useRef(call);

  useEffect(() => {
    latest.current = options;
    callRef.current = call;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const voice = controller.current;
      controller.current = null;
      voice?.end();
    };
  }, []);

  const launch = useCallback((resume?: LiveResume) => {
    if (!mounted.current || controller.current) return;
    const audio = audioRef.current;
    if (!audio) {
      setCall((previous) => ({ ...previous, error: "Voice playback is not mounted." }));
      return;
    }
    let endpoint: URL;
    try {
      endpoint = new URL(latest.current.url ?? "/api/live", window.location.href);
      if (endpoint.protocol === "https:") endpoint.protocol = "wss:";
      if (endpoint.protocol === "http:") endpoint.protocol = "ws:";
    } catch {
      setCall((previous) => ({ ...previous, error: "Invalid voice connection URL." }));
      return;
    }
    const voice = createLiveVoice({
      url: endpoint.href,
      audio,
      resume,
      getStartContext: () => latest.current.getStartContext(),
      onEvent(event) {
        if (!mounted.current || controller.current !== voice) return;
        if (event.type === "app.connected") {
          setCall((previous) => ({ ...previous, status: "connected", hasConnected: true }));
        } else if (event.type === "app.interview.started") {
          setCall((previous) => ({
            ...previous,
            interviewId: typeof event.interviewId === "string" ? event.interviewId : null,
          }));
        } else if (event.type === "app.time.limit") {
          const remaining = event["remainingMs"];
          setCall((previous) => ({
            ...previous,
            endsAt:
              typeof remaining === "number" && Number.isFinite(remaining) && remaining >= 0
                ? Date.now() + remaining
                : null,
          }));
        } else if (event.type === "app.time_up") {
          const message = event["message"];
          setCall((previous) => ({
            ...previous,
            notice: typeof message === "string" ? message.slice(0, 300) : "Time's up.",
          }));
        } else if (event.type === "app.media.unstable" || event.type === "app.media.stable") {
          setCall((previous) => ({ ...previous, unstable: event.type === "app.media.unstable" }));
        } else if (event.type === "app.stopping") {
          setCall((previous) => ({ ...previous, status: "stopping", playbackBlocked: false }));
        } else if (event.type === "app.closed") {
          controller.current = null;
          const ending = event["ending"];
          setCall((previous) => ({
            ...previous,
            status: "closed",
            muted: false,
            playbackBlocked: false,
            unstable: false,
            finalized: event.finalized === true,
            ending:
              ending === "user" ||
              ending === "dropped" ||
              ending === "time_up" ||
              ending === "failed"
                ? ending
                : "failed",
          }));
        } else if (event.type === "app.playback.blocked" || event.type === "app.playback.resumed") {
          setCall((previous) => ({
            ...previous,
            playbackBlocked: event.type === "app.playback.blocked",
          }));
        } else if (
          ["app.error", "app.greeting.error", "gateway.error", "error"].includes(event.type)
        ) {
          setCall((previous) => ({
            ...previous,
            error: event.error?.message ?? "Voice request failed.",
          }));
        }
        try {
          void Promise.resolve(latest.current.onEvent?.(event)).catch((error) => {
            console.error("Live UI event handler failed", error);
          });
        } catch (error) {
          console.error("Live UI event handler failed", error);
        }
      },
    });
    controller.current = voice;
    setCall((previous) =>
      resume
        ? {
            ...initialState,
            status: "connecting",
            hasConnected: previous.hasConnected,
            interviewId: previous.interviewId,
            muted: false,
            resumed: true,
          }
        : { ...initialState, status: "connecting" },
    );
    void voice.start();
  }, []);

  const start = useCallback(() => launch(), [launch]);

  /**
   * Resumes a dropped interview without using another credit. The recap of the
   * conversation so far helps Dr River carry on where the call left off.
   */
  const reconnect = useCallback(
    (recap: string) => {
      const id = callRef.current.interviewId;
      if (callRef.current.ending !== "dropped" || !id) return;
      launch({ interviewId: id, recap });
    },
    [launch],
  );

  /** Gives up on resuming a dropped interview, so it is treated as finished. */
  const dismissReconnect = useCallback(() => {
    setCall((previous) =>
      previous.ending === "dropped" && previous.status === "closed"
        ? { ...previous, ending: "user" }
        : previous,
    );
  }, []);

  const stop = useCallback(() => {
    controller.current?.end();
  }, []);
  const setMuted = useCallback((muted: boolean) => {
    if (controller.current?.setMuted(muted)) setCall((previous) => ({ ...previous, muted }));
  }, []);
  const resumePlayback = useCallback(() => {
    void controller.current?.resumePlayback();
  }, []);

  return {
    ...call,
    audioRef,
    start,
    reconnect,
    dismissReconnect,
    stop,
    setMuted,
    resumePlayback,
  };
}

function nextOpeningTurn() {
  const randomTurn = Math.floor(Math.random() * 1000) + 1;
  try {
    const saved = Number(localStorage.getItem("compass-opening-turn"));
    const turn = Number.isSafeInteger(saved) && saved > 0 ? saved + 1 : randomTurn;
    localStorage.setItem("compass-opening-turn", String(turn));
    return turn;
  } catch {
    return randomTurn;
  }
}

type LiveOptions = {
  url: string;
  audio: HTMLAudioElement;
  resume?: LiveResume | undefined;
  getStartContext: () => Promise<LiveStartContext>;
  onEvent: (event: LiveEvent) => void;
};

function createLiveVoice(options: LiveOptions) {
  let state: "idle" | "starting" | "active" | "stopping" | "closed" = "idle";
  let socket: WebSocket | undefined;
  let peer: RTCPeerConnection | undefined;
  let channel: RTCDataChannel | undefined;
  let microphone: MediaStream | undefined;
  let playback: MediaStream | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let cancelGathering: (() => void) | undefined;
  let lastAck = 0;
  let mediaLostSince: number | undefined;
  let answerReceived = false;
  let finalized = false;
  let muted = false;
  // How the call is ending, so the UI can tell a dropped call from one the student ended.
  let wasActive = false;
  let endedByUser = false;
  let timeUp = false;
  let resumable = true;

  function starting() {
    return state === "starting";
  }

  function send(event: object) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
  }

  function stopAudio() {
    microphone?.getTracks().forEach((track) => track.stop());
    if (playback && options.audio.srcObject === playback) {
      options.audio.pause();
      options.audio.srcObject = null;
    }
  }

  function ending(): LiveEnding {
    if (timeUp) return "time_up";
    if (endedByUser) return "user";
    return wasActive && resumable ? "dropped" : "failed";
  }

  function release() {
    if (state === "closed") return;
    state = "closed";
    clearInterval(heartbeat);
    clearTimeout(deadline);
    cancelGathering?.();
    window.removeEventListener("pagehide", end);
    stopAudio();
    channel?.close();
    peer?.close();
    socket?.close();
    options.onEvent({ type: "app.closed", finalized, ending: ending() });
  }

  function stop() {
    if (state === "stopping" || state === "closed") return;
    state = "stopping";
    try {
      send({ type: "session.close" });
    } catch {
      return release();
    }
    stopAudio();
    cancelGathering?.();
    clearInterval(heartbeat);
    clearTimeout(deadline);
    deadline = setTimeout(release, 15_000);
    options.onEvent({ type: "app.stopping" });
    if (!socket || socket.readyState !== WebSocket.OPEN) release();
  }

  /** Ends the call at the student's request. */
  function end() {
    if (state === "stopping" || state === "closed") return;
    endedByUser = true;
    stop();
  }

  function setMuted(value: boolean) {
    if (state !== "starting" && state !== "active") return false;
    muted = value;
    microphone?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    return true;
  }

  async function resumePlayback() {
    if ((state !== "starting" && state !== "active") || !options.audio.srcObject) return;
    try {
      await options.audio.play();
      if (state === "starting" || state === "active")
        options.onEvent({ type: "app.playback.resumed" });
    } catch {
      if (state === "starting" || state === "active")
        options.onEvent({ type: "app.playback.blocked" });
    }
  }

  function fail(message: string) {
    if (state === "stopping" || state === "closed") return;
    options.onEvent({ type: "app.error", error: { message } });
    stop();
  }

  function reportUnexpectedClosure(reason?: string) {
    if (state === "stopping" || state === "closed") return;
    if (reason === "duration_limit") resumable = false;
    // Once a call has connected the UI offers Reconnect instead of a new call.
    const retry = wasActive ? "" : " Start a new call to retry.";
    const messages: Record<string, string> = {
      startup_timeout: `Voice startup timed out.${retry}`,
      initial_heartbeat_timeout: `Voice media did not connect.${retry}`,
      heartbeat_timeout: `Voice connection was lost.${retry}`,
      gateway_shutdown: `The voice service restarted.${retry}`,
      inactivity_timeout: "The voice call ended after inactivity.",
      duration_limit: "The voice call reached its duration limit.",
    };
    options.onEvent({
      type: "app.error",
      error: {
        message: messages[reason ?? ""] ?? `The voice call ended unexpectedly.${retry}`,
      },
    });
  }

  function mediaReady() {
    return peer?.connectionState === "connected" && channel?.readyState === "open";
  }

  function pulse() {
    if (state !== "active") return;
    const now = Date.now();
    if (now - lastAck >= HEARTBEAT_ACK_WINDOW_MS) return fail("Voice control connection lost.");
    // Brief ICE interruptions ("disconnected") often recover by themselves, so allow a
    // grace period before treating the call as dropped.
    if (peer?.connectionState === "connected") {
      if (mediaLostSince !== undefined) {
        mediaLostSince = undefined;
        options.onEvent({ type: "app.media.stable" });
      }
    } else if (mediaLostSince === undefined) {
      mediaLostSince = now;
      options.onEvent({ type: "app.media.unstable" });
    } else if (now - mediaLostSince >= MEDIA_RECOVERY_GRACE_MS) {
      return fail("Voice media connection lost.");
    }
    if (channel?.readyState !== "open") return;
    try {
      // Keep the session alive while media recovers; the control socket is separate.
      send({ type: "gateway.heartbeat" });
    } catch {
      fail("Voice control connection failed.");
    }
  }

  function activate() {
    if (state === "active") return pulse();
    if (!answerReceived || !mediaReady() || !starting()) return;
    state = "active";
    wasActive = true;
    clearTimeout(deadline);
    lastAck = Date.now();
    heartbeat = setInterval(pulse, 1000);
    pulse();
    if (state !== "active") return;
    send({ type: "app.ready" });
    options.onEvent({ type: "app.connected" });
  }

  async function applyAnswer(event: LiveEvent) {
    if (!starting() || !peer) return;
    if (answerReceived || event.transport?.type !== "webrtc" || !event.transport.sdp) {
      throw new Error("Invalid voice session answer");
    }
    answerReceived = true;
    clearTimeout(deadline);
    deadline = setTimeout(
      () => fail("Voice media did not connect within 12 seconds. Start a new call to retry."),
      12_000,
    );
    await peer.setRemoteDescription({ type: "answer", sdp: event.transport.sdp });
    activate();
  }

  async function gatherCandidates(connection: RTCPeerConnection) {
    if (connection.iceGatheringState === "complete") return;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error("Voice network setup timed out")), 10_000);
      function finish(error?: Error) {
        clearTimeout(timeout);
        connection.removeEventListener("icegatheringstatechange", changed);
        cancelGathering = undefined;
        if (error) reject(error);
        else resolve();
      }
      function changed() {
        if (connection.iceGatheringState === "complete") finish();
      }
      cancelGathering = () => finish(new Error("Call ended"));
      connection.addEventListener("icegatheringstatechange", changed);
      changed();
    });
  }

  async function start() {
    if (state !== "idle") return;
    state = "starting";
    window.addEventListener("pagehide", end);
    // Covers sign-in, the microphone prompt and network setup, so the call can never sit on
    // "connecting" forever before the voice service is contacted.
    deadline = setTimeout(() => fail(STARTUP_TIMEOUT_MESSAGE), STARTUP_TIMEOUT_MS);
    try {
      const startContext = await options.getStartContext();
      if (!starting()) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: MICROPHONE_CONSTRAINTS,
      });
      microphone = stream;
      if (!starting()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const connection = new RTCPeerConnection();
      peer = connection;
      for (const track of stream.getAudioTracks()) {
        track.enabled = !muted;
        track.addEventListener("ended", () => fail("Your microphone was disconnected."));
        connection.addTrack(track, stream);
      }
      connection.addEventListener("track", ({ track }) => {
        if (state === "stopping" || state === "closed") return;
        playback = new MediaStream([track]);
        options.audio.srcObject = playback;
        void resumePlayback();
      });
      connection.addEventListener("connectionstatechange", () => {
        // "disconnected" is left to pulse(), which allows time to recover. There is no
        // renegotiation channel through the relay, so an ICE restart cannot be completed;
        // a call that does not recover is offered Reconnect instead.
        if (connection.connectionState === "failed") fail("Voice media connection failed.");
        else if (connection.connectionState === "closed") fail("Voice media connection closed.");
        else activate();
      });
      channel = connection.createDataChannel("oai-events");
      channel.addEventListener("open", activate);
      channel.addEventListener("message", ({ data }) => {
        try {
          const event: LiveEvent = JSON.parse(data);
          if (event.type === "session.started") {
            activate();
          }
        } catch {
          fail("Invalid voice session event");
        }
      });
      channel.addEventListener("error", () => fail("Voice media connection failed."));
      channel.addEventListener("close", () => fail("Voice media connection closed."));
      await connection.setLocalDescription(await connection.createOffer());
      if (!starting()) return;
      await gatherCandidates(connection);
      if (!starting()) return;
      const sdp = connection.localDescription?.sdp;
      if (!sdp) throw new Error("Missing voice session offer");
      socket = new WebSocket(options.url);
      clearTimeout(deadline);
      deadline = setTimeout(() => fail("Voice session did not start"), 50_000);
      socket.onopen = () => {
        if (!starting()) return release();
        send({
          type: "app.start",
          sdp,
          openingTurn: nextOpeningTurn(),
          ...startContext,
          ...(options.resume
            ? { resumeInterviewId: options.resume.interviewId, recap: options.resume.recap }
            : {}),
        });
      };
      socket.onmessage = ({ data }) => {
        try {
          const event: LiveEvent = JSON.parse(data);
          if (event.type === "gateway.session.created") {
            void applyAnswer(event).catch(() => fail("Voice media negotiation failed"));
          } else if (event.type === "session.started") {
            activate();
          } else if (event.type === "gateway.heartbeat.ack") {
            lastAck = Date.now();
          } else if (event.type === "app.time_up") {
            // A normal ending: the server closes the session once time is up.
            timeUp = true;
            options.onEvent(event);
            return stop();
          } else if (event.type === "session.closed") {
            finalized =
              typeof event.usage?.seconds === "number" &&
              Number.isFinite(event.usage.seconds) &&
              event.usage.seconds >= 0;
            reportUnexpectedClosure(event.reason);
            options.onEvent(event);
            return release();
          } else if (
            event.type === "gateway.session.closing" ||
            event.type === "gateway.error" ||
            event.type === "app.error"
          ) {
            if (event.type === "gateway.session.closing") reportUnexpectedClosure(event.reason);
            options.onEvent(event);
            return stop();
          }
          options.onEvent(event);
        } catch {
          fail("Invalid voice event");
        }
      };
      socket.onerror = () => fail("Voice connection failed.");
      socket.onclose = () => {
        if (state !== "stopping" && state !== "closed") {
          options.onEvent({
            type: "app.error",
            error: { message: "Voice control connection closed." },
          });
        }
        release();
      };
    } catch (error) {
      fail(microphoneErrorMessage(error));
    }
  }

  return { start, end, setMuted, resumePlayback };
}

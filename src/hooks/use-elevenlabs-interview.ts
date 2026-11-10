import { useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";

export type InterviewEvent =
  | { type: "app.transcript"; role: "user" | "assistant"; text: string }
  | { type: "app.transcript.correction"; originalText: string; correctedText: string };

type InterviewPhase = "idle" | "connecting" | "connected" | "stopping" | "closed";

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

export function useElevenLabsInterview({
  onEvent,
}: {
  onEvent: (event: InterviewEvent) => void;
}) {
  const latestOnEvent = useRef(onEvent);
  const attempt = useRef(0);
  const [phase, setPhase] = useState<InterviewPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    latestOnEvent.current = onEvent;
  }, [onEvent]);

  const conversation = useConversation({
    stripAudioTags: true,
    onConnect: () => {
      setPhase("connected");
    },
    onDisconnect: (details) => {
      setPhase("closed");
      if (details.reason === "error") setError(details.message);
    },
    onError: (message) => {
      setPhase((current) => (current === "connecting" ? "closed" : current));
      setError(message || "The voice interview hit a problem. Please start a new interview.");
    },
    onMessage: ({ role, message }) => {
      if (!message.trim()) return;
      latestOnEvent.current({
        type: "app.transcript",
        role: role === "agent" ? "assistant" : "user",
        text: message,
      });
    },
    onAgentResponseCorrection: ({ original_agent_response, corrected_agent_response }) => {
      latestOnEvent.current({
        type: "app.transcript.correction",
        originalText: original_agent_response,
        correctedText: corrected_agent_response,
      });
    },
  });

  const { startSession, endSession } = conversation;

  const start = useCallback(async () => {
    const id = ++attempt.current;
    setError(null);
    setPhase("connecting");
    try {
      const response = await fetch("/api/elevenlabs/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ openingTurn: nextOpeningTurn() }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        signedUrl?: string;
        firstMessage?: string;
        error?: string;
      };
      if (!response.ok || !data.signedUrl || !data.firstMessage) {
        throw new Error(data.error || "ElevenLabs could not start the interview.");
      }
      if (id !== attempt.current) return;
      startSession({
        signedUrl: data.signedUrl,
        connectionType: "websocket",
        overrides: { agent: { firstMessage: data.firstMessage } },
      });
    } catch (cause) {
      if (id !== attempt.current) return;
      setPhase("closed");
      setError(cause instanceof Error ? cause.message : "The interview could not be started.");
    }
  }, [startSession]);

  const stop = useCallback(() => {
    ++attempt.current;
    setPhase((current) => (current === "idle" || current === "closed" ? current : "stopping"));
    endSession();
  }, [endSession]);

  useEffect(
    () => () => {
      ++attempt.current;
      endSession();
    },
    [endSession],
  );

  return {
    status: phase,
    error,
    muted: conversation.isMuted,
    speaking: conversation.isSpeaking,
    start,
    stop,
    setMuted: conversation.setMuted,
  };
}

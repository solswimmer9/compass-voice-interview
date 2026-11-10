import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { emailReading } from "@/utils/reading.functions";

/** Sends the reading to the signed-in student's own email. */
export function EmailReadingButton({ readingId }: { readingId: string }) {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (!loading && !user) {
    return (
      <Link to="/auth" className="text-sm underline">
        Sign in to email this reading to yourself
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={loading || status === "sending"}
        onClick={async () => {
          setStatus("sending");
          setMessage(null);
          try {
            const result = await emailReading({ data: { readingId } });
            setStatus("sent");
            setMessage(`Sent to ${result.sentTo}. Read it when you're ready, then come back.`);
          } catch (error) {
            setStatus("idle");
            setMessage(error instanceof Error ? error.message : "The email couldn't be sent.");
          }
        }}
        className="rounded-full border px-5 py-2 text-sm font-medium transition hover:bg-secondary disabled:opacity-40"
      >
        {status === "sending"
          ? "Sending…"
          : status === "sent"
            ? "Send again"
            : "Email me this reading"}
      </button>
      {message && (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}

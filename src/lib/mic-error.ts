// Plain-English messages for microphone problems when an interview starts.

export function microphoneErrorMessage(error: unknown): string {
  const name = (error as { name?: unknown } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError")
    return "Your browser blocked the microphone. Allow microphone access for this site (usually the icon in the address bar), then press Start again.";
  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    name === "OverconstrainedError"
  )
    return "No microphone was found. Plug one in or choose one in your device's sound settings, then press Start again.";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError")
    return "Your microphone is being used by another app or tab. Close it, then press Start again.";
  return error instanceof Error && error.message ? error.message : "Microphone startup failed";
}

const PREVIEW_SUFFIXES = ["lovable.app", "gpt-eng.com", "gptengineer.run"];

export function isPreviewHostname(value: string) {
  const hostname = value.trim().toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  const labels = hostname.split(".");
  const first = labels[0] ?? "";
  const suffix = PREVIEW_SUFFIXES.find((candidate) => hostname.endsWith(`.${candidate}`));
  if (!suffix) return false;
  if (/^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(first)) return true;
  if (/^project--[0-9a-f-]{36}-dev$/.test(first)) return true;
  if (/^live--[0-9a-f-]{36}(?:-thr_[a-z0-9]+)?$/.test(first)) {
    const suffixLabels = suffix.split(".").length;
    return labels.length === suffixLabels + 2;
  }
  return false;
}

export function isPreviewRequest(request: Request) {
  return isPreviewHostname(new URL(request.url).hostname);
}

export function isPreviewBrowser() {
  return typeof window !== "undefined" && isPreviewHostname(window.location.hostname);
}

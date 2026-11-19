// Every model the app calls, in one place, so a change of model is one edit and each
// interview's run manifest can say exactly which models produced it. All calls go through the
// Lovable AI gateway with the server-only LOVABLE_API_KEY.

/** Speech-to-speech model for the live interview. */
export const LIVE_MODEL = "openai/gpt-live-1";
/** Text model behind the live tutor: follow-up challenges and the turn analyst. */
export const BACKEND_MODEL = "openai/gpt-6-astra";
/** Text model for the feedback letter, its quote checks and the argument map. */
export const FEEDBACK_MODEL = "openai/gpt-6-astra";
/** Model for feedback on an uploaded video. */
export const VIDEO_FEEDBACK_MODEL = "google/gemini-3.8-flash";

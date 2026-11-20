import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  parseInterviewChoice,
  rememberChoiceForSignIn,
  type InterviewChoice,
} from "@/lib/interview-choice";
import { parseCheckoutSessionId } from "@/lib/checkout-return";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/components/AuthProvider";
import "@lovable.dev/cloud-auth-js/styles.css";

export const Route = createFileRoute("/auth")({
  // Which interview the student was on, so signing in returns them to the same one.
  // session_id: a paid checkout to confirm after signing in (see /checkout/success).
  validateSearch: (
    search: Record<string, unknown>,
  ): Omit<InterviewChoice, "reading"> & { session_id?: string } => {
    const { tutor, mode } = parseInterviewChoice(search);
    const sessionId = parseCheckoutSessionId(search["session_id"]);
    return {
      ...(tutor ? { tutor } : {}),
      ...(mode ? { mode } : {}),
      ...(sessionId ? { session_id: sessionId } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Sign in | Oxbridge Interview Practice" },
      {
        name: "description",
        content: "Sign in to practise interviews, save purchases, and receive AI feedback.",
      },
      { property: "og:title", content: "Sign in to Oxbridge Interview Practice" },
      {
        property: "og:description",
        content: "Access your free interview and purchased interview packs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function GoogleIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { tutor, mode: interviewMode, session_id: checkoutSessionId } = Route.useSearch();
  const interviewSearch = {
    ...(tutor ? { tutor } : {}),
    ...(interviewMode ? { mode: interviewMode } : {}),
  };
  // With a subject chosen, signing in carries straight on into the interview. A paid checkout
  // waiting for confirmation takes priority, so the buyer sees their purchase.
  const backToInterview = () =>
    checkoutSessionId
      ? navigate({ to: "/checkout/success", search: { session_id: checkoutSessionId } })
      : tutor || interviewMode
        ? navigate({ to: "/interview", search: { ...interviewSearch, start: true as const } })
        : navigate({ to: "/" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  // The page title follows the form, so "Create an account" is not titled "Sign in".
  useEffect(() => {
    document.title =
      mode === "signup"
        ? "Create an account | Oxbridge Interview Practice"
        : "Sign in | Oxbridge Interview Practice";
  }, [mode]);
  const [busy, setBusy] = useState(false);

  const socialSignIn = async (provider: "google" | "lovable") => {
    setBusy(true);
    setMessage(null);
    // Google and Lovable sign-in leave the site and come back to the home page.
    rememberChoiceForSignIn(interviewSearch);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) setMessage(result.error.message);
    else if (!result.redirected) await backToInterview();
    setBusy(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    if (mode === "signup") {
      // The confirmation link comes back to the home page, usually in this browser.
      rememberChoiceForSignIn(interviewSearch);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { display_name: displayName } },
      });
      if (error) setMessage(error.message);
      else if (!data.session) setMessage("Check your email to confirm your account, then sign in.");
      else await backToInterview();
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else await backToInterview();
    }
    setBusy(false);
  };

  const forgotPassword = async () => {
    if (!email) return setMessage("Enter your email first.");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setMessage(error ? error.message : "Check your email for a password reset link.");
    setBusy(false);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link to="/" className="mb-8 text-sm text-muted-foreground">
        ← Back to interview practice
      </Link>
      <h1 className="font-serif text-4xl font-semibold">
        {user ? "You’re signed in" : mode === "signin" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your purchases and interview allowance stay with your account.
      </p>
      {loading ? null : user ? (
        <div className="mt-8 space-y-4">
          <p className="text-sm">{user.email}</p>
          <Link
            to={tutor || interviewMode ? "/interview" : "/subjects"}
            search={interviewSearch}
            className="inline-flex rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground"
          >
            Continue to practice
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void socialSignIn("google")}
              className="flex items-center justify-center gap-3 rounded-md border px-4 py-3 text-sm font-medium"
              style={{ backgroundColor: "#131314", borderColor: "#8E918F", color: "#E3E3E3" }}
            >
              <GoogleIcon /> Continue with Google
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void socialSignIn("lovable")}
              className="lovable-auth-button"
            >
              Continue with Lovable
            </button>
          </div>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or use email
            <span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <label className="block text-sm">
                Display name
                <input
                  required
                  maxLength={80}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                />
              </label>
            )}
            <label className="block text-sm">
              Email
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Password
              <input
                required
                minLength={6}
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              />
            </label>
            <button
              disabled={busy}
              className="w-full rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground disabled:opacity-40"
            >
              {mode === "signin" ? "Sign in" : "Sign up"}
            </button>
          </form>
          <div className="mt-4 flex justify-between text-sm">
            <button
              type="button"
              className="underline"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setMessage(null);
              }}
            >
              {mode === "signin" ? "Create an account" : "I already have an account"}
            </button>
            <button type="button" className="underline" onClick={() => void forgotPassword()}>
              Forgot password?
            </button>
          </div>
        </>
      )}
      {message && (
        <p role="status" className="mt-5 text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </main>
  );
}

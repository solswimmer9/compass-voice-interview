import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password | Oxbridge Interview Practice" },
      { name: "description", content: "Choose a new password for your interview practice account." },
      { property: "og:title", content: "Reset your interview practice password" },
      { property: "og:description", content: "Securely choose a new account password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [validRecovery, setValidRecovery] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (params.get("type") === "recovery") setValidRecovery(true);
    else setMessage("This reset link is invalid or incomplete. Request a new one from sign in.");
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setMessage(error.message);
    else await navigate({ to: "/auth" });
    setBusy(false);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <h1 className="font-serif text-4xl font-semibold">Choose a new password</h1>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block text-sm">New password
          <input required minLength={6} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2" />
        </label>
        <button disabled={!validRecovery || busy} className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground disabled:opacity-40">Update password</button>
      </form>
      {message && <p role="status" className="mt-5 text-sm text-muted-foreground">{message}</p>}
    </main>
  );
}

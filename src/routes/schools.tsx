import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Copy, Ticket } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BuyPackButton } from "@/components/pricing/BuyPackButton";
import { PricingShell } from "@/components/pricing/PricingShell";
import { SCHOOL_BUNDLE } from "@/lib/offer";
import { getStripeEnvironment } from "@/lib/stripe";
import { claimSchoolInterview, getSchoolBundles } from "@/utils/schools.functions";

export const Route = createFileRoute("/schools")({
  head: () => ({ meta: [
    { title: "School Interview Bundles | Oxbridge Interview Practice" },
    { name: "description", content: "Buy 30 shared geography interviews for up to 30 students. £1,250 per admissions cycle, with AI feedback and a school code." },
    { property: "og:title", content: "School Interview Bundles | Oxbridge Interview Practice" },
    { property: "og:description", content: "Geography interview practice for your school: 30 shared interviews with AI feedback." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: SchoolsPage,
});

function SchoolsPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const bundles = useQuery({ queryKey: ["school-bundles", user?.id], enabled: Boolean(user),
    queryFn: () => getSchoolBundles({ data: { environment: getStripeEnvironment() } }), refetchInterval: 15000 });
  async function claim(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await claimSchoolInterview({ data: { code: code.trim(), environment: getStripeEnvironment() } });
      if ("error" in result) throw new Error(result.error);
      setMessage("One school interview added to your account.");
      await client.invalidateQueries();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not claim interview"); }
    finally { setBusy(false); }
  }
  return <PricingShell wide>
    <section className="mt-14 border-b pb-10">
      <Building2 className="h-8 w-8 text-accent" aria-hidden="true" />
      <h1 className="mt-5 font-serif text-4xl font-semibold">Interview practice for schools</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">Geography interviews with Dr River and individual AI reasoning feedback.</p>
      <div className="mt-8 flex flex-wrap items-end gap-6">
        <div><p className="font-serif text-5xl">{SCHOOL_BUNDLE.displayPrice}</p><p className="mt-2 text-sm text-muted-foreground">One-off payment per admissions cycle · tax added at checkout</p></div>
        <BuyPackButton offer={SCHOOL_BUNDLE} label="Buy school bundle" />
      </div>
      <ul className="mt-8 grid gap-3 text-sm sm:grid-cols-3"><li>30 shared voice interviews</li><li>Up to 30 signed-in students</li><li>Valid until the next 31 August</li></ul>
    </section>
    <section className="py-10">
      <h2 className="font-serif text-2xl">Your school bundles</h2>
      {!user ? <Link to="/auth" className="mt-4 inline-block underline">Sign in to buy or use a school code</Link> : <>
        {bundles.isPending && <p className="mt-4 text-muted-foreground">Loading school purchases…</p>}
        {bundles.error && <p role="alert" className="mt-4 text-destructive">{bundles.error.message}</p>}
        {bundles.data?.length === 0 && <p className="mt-4 text-muted-foreground">No school purchases yet.</p>}
        <div className="mt-5 space-y-5">{bundles.data?.map(bundle => <article key={bundle.id} className="rounded-lg border p-5">
          <p className="font-medium">{bundle.interviews_remaining} unclaimed interviews · {bundle.status}</p>
          <p className="mt-2 text-sm text-muted-foreground">Expires {new Date(bundle.expires_at).toLocaleDateString("en-GB")}</p>
          <div className="mt-4 flex items-center gap-3"><code className="min-w-0 break-all text-sm">{bundle.code}</code>
            <Button variant="outline" size="icon" aria-label="Copy school code" title="Copy school code" onClick={async () => { try { await navigator.clipboard.writeText(bundle.code); setMessage("School code copied."); } catch { setMessage("Could not copy. Select the code to copy it."); } }}><Copy className="h-4 w-4" /></Button></div>
        </article>)}</div>
        <form onSubmit={claim} className="mt-10 max-w-lg border-t pt-8">
          <h2 className="font-serif text-2xl">Use a school code</h2>
          <label htmlFor="school-code" className="mt-5 block text-sm">School code</label>
          <Input id="school-code" value={code} onChange={event => setCode(event.target.value)} required maxLength={32} autoComplete="off" className="mt-2" />
          <Button type="submit" disabled={busy} className="mt-4"><Ticket className="mr-2 h-4 w-4" />{busy ? "Claiming…" : "Claim one interview"}</Button>
          <Link to="/" className="ml-4 inline-block text-sm underline">Go to interview</Link>
        </form>
      </>}
      {message && <p role="status" className="mt-4 text-sm">{message}</p>}
    </section>
  </PricingShell>;
}
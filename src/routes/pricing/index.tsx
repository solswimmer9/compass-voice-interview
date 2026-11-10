import { createFileRoute, redirect } from "@tanstack/react-router";

// /pricing shows the Lifetime pricing page.
export const Route = createFileRoute("/pricing/")({
  beforeLoad: () => {
    throw redirect({ to: "/pricing/lifetime" });
  },
});

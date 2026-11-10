import { createFileRoute, redirect } from "@tanstack/react-router";

// /pricing shows the chosen Lifetime design.
export const Route = createFileRoute("/pricing/")({
  beforeLoad: () => {
    throw redirect({ to: "/pricing/lifetime" });
  },
});

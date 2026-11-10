import { createFileRoute, redirect } from "@tanstack/react-router";

// /pricing shows the chosen Compare design.
export const Route = createFileRoute("/pricing/")({
  beforeLoad: () => {
    throw redirect({ to: "/pricing/compare" });
  },
});

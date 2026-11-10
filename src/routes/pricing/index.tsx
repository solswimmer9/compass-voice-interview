import { createFileRoute, redirect } from "@tanstack/react-router";

// Until one design is chosen, /pricing shows the first draft.
export const Route = createFileRoute("/pricing/")({
  beforeLoad: () => {
    throw redirect({ to: "/pricing/simple" });
  },
});

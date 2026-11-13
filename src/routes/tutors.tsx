import { createFileRoute, redirect } from "@tanstack/react-router";

// The subject picker moved to /subjects. Keep this address working for old links.
export const Route = createFileRoute("/tutors")({
  beforeLoad: () => {
    throw redirect({ to: "/subjects" });
  },
});

import { createFileRoute, redirect } from "@tanstack/react-router";

// The subject picker now lives on the home page. Keep this address working for old links.
export const Route = createFileRoute("/tutors")({
  beforeLoad: () => {
    throw redirect({ to: "/", hash: "subjects" });
  },
});

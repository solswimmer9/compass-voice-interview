import { Link } from "@tanstack/react-router";
import { useAuth } from "@/components/AuthProvider";

/** The top menu on the home, subject and feedback pages. Hidden in the interview room. */
export function SiteNav({ back }: { back?: "home" }) {
  const { user } = useAuth();
  return (
    <nav
      className={`relative z-20 mx-auto flex max-w-3xl items-center gap-5 px-6 pt-6 text-sm ${back ? "justify-between" : "justify-end"}`}
    >
      {back && (
        <Link to="/" className="text-muted-foreground transition hover:text-foreground">
          ← Home
        </Link>
      )}
      <span className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
        <Link to="/subjects" className="text-muted-foreground transition hover:text-foreground">
          Subjects
        </Link>
        <Link to="/tutors" className="text-muted-foreground transition hover:text-foreground">
          Tutors
        </Link>
        <Link to="/schools" className="text-muted-foreground transition hover:text-foreground">
          Schools
        </Link>
        <Link to="/pricing" className="text-muted-foreground transition hover:text-foreground">
          Pricing
        </Link>
        {user ? (
          <Link to="/account" className="underline">
            Your account
          </Link>
        ) : (
          <Link to="/auth" className="underline">
            Sign in
          </Link>
        )}
      </span>
    </nav>
  );
}

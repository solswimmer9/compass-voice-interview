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
      <span className="flex items-center gap-5">
        <Link to="/subjects" className="text-muted-foreground transition hover:text-foreground">
          Subjects
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

import { Link } from "@tanstack/react-router";
import { useAuth } from "@/components/AuthProvider";

/** The top menu on the home, subject and feedback pages. Hidden in the interview room. */
export function SiteNav({ back }: { back?: "home" }) {
  const { user } = useAuth();
  const link = "text-[#f5f5f7]/80 transition hover:text-white";
  return (
    <div className="relative z-30 px-4 pt-4">
      <nav
        aria-label="Main"
        className="glass-nav mx-auto flex h-[52px] max-w-[1024px] items-center justify-between gap-5 rounded-[18px] px-6 text-[14px] tracking-[-0.016em]"
      >
        <Link to="/" className="font-semibold text-white" aria-label="Compass home">
          {back ? "← Compass" : "Compass"}
        </Link>
        <span className="flex items-center gap-4 whitespace-nowrap sm:gap-6">
          <Link to="/subjects" className={link}>
            Subjects
          </Link>
          <Link to="/pricing" className={link}>
            Pricing
          </Link>
          {user ? (
            <Link to="/account" className={link}>
              Your account
            </Link>
          ) : (
            <Link to="/auth" className={link}>
              Sign in
            </Link>
          )}
          <Link to="/subjects" className="btn-pill btn-pill-sm hidden sm:inline-flex">
            Start
          </Link>
        </span>
      </nav>
    </div>
  );
}

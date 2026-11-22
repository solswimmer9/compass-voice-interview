import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";

/**
 * The Grey Meridian look shared by the home, subject and pricing pages: a grey page with a
 * framed light panel, Instrument Serif headings, Inter Tight text and small mono labels.
 * Animations and the .meridian scope live in src/styles.css.
 */
export const serif = "font-instrument font-normal";
export const mono = "font-jbmono";
export const darkButton =
  "inline-flex items-center justify-center rounded bg-[#161616] px-[22px] py-3.5 text-sm text-[#f7f7f5] transition-colors hover:bg-[#3a3a3a]";
export const lightButton =
  "inline-flex items-center justify-center rounded border border-[#161616] px-[22px] py-3.5 text-sm text-[#161616] transition-colors hover:bg-white";

/** Grey page with the site's width; `framed` content goes in the light panel under the nav. */
export function MeridianPage({ children, framed }: { children: ReactNode; framed?: ReactNode }) {
  return (
    <div className="meridian min-h-[100svh] bg-[#ededeb] font-tight text-[#161616]">
      <div className="mx-auto max-w-[1320px] px-3 pt-4 sm:px-6">
        <div className="overflow-hidden rounded-[14px] bg-[#f7f7f5]">
          <MeridianHeader />
          {framed}
        </div>
        {children}
        <MeridianFooter />
      </div>
    </div>
  );
}

export function MeridianHeader() {
  const { user } = useAuth();
  return (
    <header className="flex flex-wrap items-center justify-between gap-5 px-6 py-[18px] text-[13px] sm:px-8">
      <Link to="/" className={`${serif} text-[26px] italic`} aria-label="Compass home">
        Compass
      </Link>
      <nav aria-label="Main" className="flex flex-wrap gap-x-7 gap-y-2">
        <Link to="/subjects" className="hover:underline" activeProps={{ className: "underline" }}>
          Subjects
        </Link>
        <Link to="/readings" search={{ subject: "ppe" }} className="hover:underline">
          Readings
        </Link>
        <Link to="/schools" className="hover:underline">
          For schools
        </Link>
        <Link
          to="/pricing/lifetime"
          className="hover:underline"
          activeProps={{ className: "underline" }}
        >
          Pricing
        </Link>
        {user ? (
          <Link to="/account" className="hover:underline">
            Your account
          </Link>
        ) : (
          <Link to="/auth" className="hover:underline">
            Sign in
          </Link>
        )}
      </nav>
      <Link
        to="/subjects"
        className="rounded bg-[#161616] px-4 py-2.5 text-[#f7f7f5] transition-colors hover:bg-[#3a3a3a]"
      >
        Start practising
      </Link>
    </header>
  );
}

export function MeridianFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-5 border-t border-[#cfcfcb] px-2 pb-10 pt-7 text-xs text-[#4a4a48]">
      <span className={`${serif} text-[22px] italic text-[#161616]`}>Compass</span>
      <span className={mono}>NOT AFFILIATED WITH OXFORD OR CAMBRIDGE · AI CAN MAKE MISTAKES</span>
    </footer>
  );
}

/** The Meridian rose: nested squares, each a little smaller and more turned, breathing in a
 * wave while the whole set turns slowly. Decoration only; fills its positioned parent. */
export function Rose({
  count = 26,
  size = 560,
  step = 18,
}: {
  count?: number;
  /** Width of the outermost square, in px. */
  size?: number;
  /** How much smaller each square is than the one outside it, in px. */
  step?: number;
}) {
  const squares = Array.from({ length: count }, (_, i) => ({
    "--w": `${size - i * step}px`,
    "--r": `${i * 7}deg`,
    animationDelay: `${(-i * 0.22).toFixed(2)}s`,
  }));
  return (
    <div aria-hidden="true" className="rose-turn absolute inset-0">
      {squares.map((style, i) => (
        <div key={i} className="rose-sq" style={style as CSSProperties} />
      ))}
    </div>
  );
}

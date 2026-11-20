import { Link } from "@tanstack/react-router";

/** Quiet, useful ending: a curated directory, then the legal line. Light surface. */
export function SiteFooter() {
  const link = "text-[#333336] hover:underline";
  return (
    <>
      <section className="surface-directory on-light py-24 sm:py-36">
        <div className="mx-auto max-w-[1260px] px-6 sm:px-[90px]">
          <h2 className="t-heading">Find your way in.</h2>
          <div className="mt-12 grid gap-12 sm:grid-cols-3">
            <ul className="space-y-3">
              <li>
                <Link to="/subjects" className={`t-card-heading ${link}`}>
                  Pick a subject
                </Link>
              </li>
              <li>
                <Link
                  to="/readings"
                  search={{ subject: "ppe" }}
                  className={`t-card-heading ${link}`}
                >
                  Practice readings
                </Link>
              </li>
              <li>
                <Link to="/pricing" className={`t-card-heading ${link}`}>
                  Pricing
                </Link>
              </li>
            </ul>
            <div>
              <h3 className="text-[12px] font-semibold text-[#6e6e73]">For schools</h3>
              <ul className="mt-3 space-y-2 text-[17px]">
                <li>
                  <Link to="/schools" className={link}>
                    Compass for schools
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-[12px] font-semibold text-[#6e6e73]">Your account</h3>
              <ul className="mt-3 space-y-2 text-[17px]">
                <li>
                  <Link to="/auth" className={link}>
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link to="/account" className={link}>
                    Account
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
      <footer className="surface-light">
        <div className="mx-auto max-w-[980px] px-[22px] py-5 text-[12px] leading-[1.333] text-[#6e6e73]">
          <p>Not affiliated with Oxford or Cambridge. AI can make mistakes.</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-[#d2d2d7] pt-3">
            <Link to="/privacy" className="hover:underline">
              Privacy
            </Link>
            <Link to="/terms" className="hover:underline">
              Terms
            </Link>
            <Link to="/refunds" className="hover:underline">
              Refunds
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}

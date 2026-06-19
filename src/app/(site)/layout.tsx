import "./site.css";
import { Nav } from "@/components/site/Nav";
import { Ticker } from "@/components/site/Ticker";
import { Footer } from "@/components/site/Footer";

/**
 * Public marketing site shell — (site) route group. Heritage direction.
 * Wraps every public page in the crimson ticker, sticky Nav and 4-col Footer,
 * and pulls in the ported prototype component/page CSS.
 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative z-[1] min-h-dvh">
      <Ticker />
      <Nav />
      <main>{children}</main>
      <Footer />
    </div>
  );
}

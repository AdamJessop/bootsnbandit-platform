/**
 * Public marketing site shell — (site) route group.
 * Heritage direction. Nav/Ticker/Footer are added in Phase 3.
 */
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="relative z-[1] min-h-dvh">{children}</div>;
}

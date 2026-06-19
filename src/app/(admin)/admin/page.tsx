import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Placeholder admin shell. Real back-of-house dashboards, calendar and CRM
 * land in Phases 9–11.
 */
export default function AdminHomePage() {
  return (
    <main className="mx-auto max-w-[1200px] px-7 py-16">
      <p className="kicker mb-3">Back of house</p>
      <h1 className="display text-[clamp(28px,5vw,48px)] text-text-primary">
        Studio Admin
      </h1>
      <p className="text-text-muted mt-4 max-w-[52ch]">
        Phase&nbsp;1 placeholder shell. Sign-in, calendar, CRM and content CMS
        arrive in later waves.
      </p>

      <Card className="mt-10 max-w-sm border-border-default bg-bg-card">
        <CardHeader>
          <CardTitle className="text-text-primary">Scaffold online</CardTitle>
        </CardHeader>
        <CardContent className="text-text-muted text-sm">
          Next.js 15 · App Router · heritage theme.
        </CardContent>
      </Card>
    </main>
  );
}

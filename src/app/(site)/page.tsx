import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Placeholder heritage home. Proves the warm-black surface, crimson/gold
 * accents, display font and shadcn primitives render. Real marketing home
 * lands in Phase 7 (Public Marketing Site).
 */
export default function HomePage() {
  return (
    <main className="mx-auto max-w-[1200px] px-7 py-24">
      <p className="eyebrow mb-4">Worksop · Nottinghamshire</p>
      <h1 className="display chrome text-[clamp(40px,8vw,88px)]">
        Boots &rsquo;n&rsquo; Bandit
      </h1>
      <p className="lead mt-5 max-w-[52ch]">
        Heritage tattooing on warm black, raspberry crimson and vintage gold.
        This is the Phase&nbsp;1 scaffold &mdash; the full marketing site lands
        in Phase&nbsp;7.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button>Enquire</Button>
        <Button variant="outline" className="border-bb-gold text-bb-gold">
          View flash
        </Button>
      </div>

      <Card className="mt-12 max-w-md border-border-default bg-bg-card">
        <CardHeader>
          <CardTitle className="text-text-primary">Theme check</CardTitle>
        </CardHeader>
        <CardContent className="text-text-muted">
          <ul className="space-y-1 text-sm">
            <li>
              <span className="text-bb-crimson">●</span> crimson #c92f4d
            </li>
            <li>
              <span className="text-bb-gold">●</span> gold #cfa05a
            </li>
            <li>
              <span className="text-bb-teal">●</span> teal #36b0a8
            </li>
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

import type { Metadata } from "next";
import { Pirata_One, Cinzel, Inter } from "next/font/google";
import "./globals.css";
import "./site.css";
import { prisma } from "@bnb/core/db";
import { mergeShellSettings } from "@/lib/site-nav";
import { Nav } from "@/components/site/Nav";
import { Ticker } from "@/components/site/Ticker";
import { Footer } from "@/components/site/Footer";

// Display blackletter face (heritage direction)
const pirata = Pirata_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pirata",
  display: "swap",
});

// Engraved caps (noir direction)
const cinzel = Cinzel({
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-cinzel-google",
  display: "swap",
});

// Termina is a licensed OTF face we cannot ship; Inter is the brand fallback.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-termina-google",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Boots 'n' Bandit — Tattoo Studio, Worksop",
  description:
    "Boots 'n' Bandit Tattoo Studio, Worksop. Heritage tattooing, custom work, flash and the Bandit Pass.",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

/** CMS SiteSettings for the shell; null (→ fallbacks) when the DB is away. */
async function loadShellSettings() {
  try {
    return await prisma.siteSettings.findFirst();
  } catch {
    return null;
  }
}

/**
 * Public marketing site root layout (apex origin). Owns the heritage theme
 * `<html>` shell + brand fonts, pulls in the global + prototype CSS, and wraps
 * every public page in the crimson Ticker, sticky Nav and 4-col Footer. The
 * Ticker lines and Footer studio details come from the CMS SiteSettings,
 * falling back to the hardcoded constants per-field.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const shell = mergeShellSettings(await loadShellSettings());
  return (
    <html
      lang="en"
      data-theme="dark"
      data-direction="heritage"
      className={`dark ${pirata.variable} ${cinzel.variable} ${inter.variable}`}
    >
      <body>
        <div className="relative z-[1] min-h-dvh">
          <Ticker lines={shell.tickerLines} />
          <Nav />
          <main>{children}</main>
          <Footer studio={shell} />
        </div>
      </body>
    </html>
  );
}

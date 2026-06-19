import type { Metadata } from "next";
import { Pirata_One, Cinzel, Inter } from "next/font/google";
import "./globals.css";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-direction="heritage"
      className={`dark ${pirata.variable} ${cinzel.variable} ${inter.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}

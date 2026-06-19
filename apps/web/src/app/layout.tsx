import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boots 'n' Bandit — Tattoo Studio, Worksop",
  description:
    "Boots 'n' Bandit Tattoo Studio, Worksop. Heritage tattooing, custom work, flash and the Bandit Pass.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" data-direction="heritage" className="dark">
      <body>{children}</body>
    </html>
  );
}

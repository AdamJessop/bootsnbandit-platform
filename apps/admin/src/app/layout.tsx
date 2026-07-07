import type { Metadata, Viewport } from "next";
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
  title: "Boots 'n' Bandit — Studio",
  description: "Boots 'n' Bandit staff back-of-house.",
  // Installable staff PWA — the manifest + service worker make the admin
  // back-of-house installable with an offline read-only app shell. The admin
  // app is its own origin (admin.<domain>) so the scope is root.
  manifest: "/manifest.webmanifest",
  applicationName: "Boots 'n' Bandit Studio",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "B'n'B Studio",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Staff PWA — keep it out of search indexes entirely (see app/robots.ts).
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#c92f4d",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-direction="heritage"
      className={`dark ${pirata.variable} ${cinzel.variable} ${inter.variable}`}
    >
      <body>
        {children}
        {/* Register the PWA service worker (offline app shell for read views). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}",
          }}
        />
      </body>
    </html>
  );
}

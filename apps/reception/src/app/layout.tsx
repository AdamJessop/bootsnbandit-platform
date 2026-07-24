import type { Metadata, Viewport } from "next";
import { Pirata_One, Inter } from "next/font/google";
import "./globals.css";

// Display blackletter face (heritage direction)
const pirata = Pirata_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pirata",
  display: "swap",
});

// Termina is a licensed OTF face we cannot ship; Inter is the brand fallback.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-termina-google",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Boots 'n' Bandit — Front Desk",
  description: "Boots 'n' Bandit studio reception kiosk.",
  // Installable kiosk PWA — the manifest + service worker make the front desk
  // installable fullscreen on the studio tablet. The reception app is its own
  // origin (reception.<domain>) so the scope is root.
  manifest: "/manifest.webmanifest",
  applicationName: "Boots 'n' Bandit Front Desk",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "B'n'B Front Desk",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Private studio kiosk — keep it out of search indexes (see app/robots.ts).
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0d0c0a",
  // Kiosk: fixed viewport, no pinch-zoom — feel like a native tablet app.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`dark ${pirata.variable} ${inter.variable}`}
    >
      <body>
        {children}
        {/* Register the PWA service worker (offline app shell). */}
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

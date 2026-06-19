import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boots 'n' Bandit — Studio",
  description: "Boots 'n' Bandit staff back-of-house.",
  // Installable staff PWA (Phase 3 finalizes the manifest + service worker).
  manifest: "/manifest.webmanifest",
  applicationName: "Boots 'n' Bandit Studio",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "B'n'B Studio",
  },
};

export const viewport: Viewport = {
  themeColor: "#c92f4d",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" data-direction="heritage" className="dark">
      <body>
        {children}
        {/* Register the PWA service worker (Phase 3 finalizes the strategy). */}
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

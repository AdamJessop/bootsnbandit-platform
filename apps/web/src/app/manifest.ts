import type { MetadataRoute } from "next";

/**
 * Public site web app manifest (served at /manifest.webmanifest, linked
 * automatically by Next). Customer-facing, so it is distinct from the staff
 * PWA manifest the admin app ships; it reuses the brand icons in
 * public/icons and the warm-black / crimson palette.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Boots 'n' Bandit Tattoo Studio",
    short_name: "Boots 'n' Bandit",
    description:
      "Heritage tattooing in Worksop — meet the artists, claim flash, send an enquiry and keep your Bandit Pass.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0d0c0a",
    theme_color: "#c92f4d",
    categories: ["lifestyle", "business"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

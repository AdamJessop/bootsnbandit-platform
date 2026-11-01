import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/**
 * The branded default share card (1200×630): the crimson star logo and the
 * "Boots 'n' Bandit / TATTOO STUDIO" lockup on the warm-black brand ground.
 * It has no request or DB inputs, so Next renders it once at build time.
 * Pages without their own image reference it via lib/seo DEFAULT_OG_IMAGE.
 */

export const alt = "Boots 'n' Bandit Tattoo Studio, Worksop";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The logo as a data URI; null if the file can't be found (text-only card). */
async function logoDataUri(): Promise<string | null> {
  for (const dir of [
    path.join(process.cwd(), "public"),
    path.join(process.cwd(), "apps", "web", "public"),
  ]) {
    try {
      const png = await readFile(path.join(dir, "bb-logo.png"));
      return `data:image/png;base64,${png.toString("base64")}`;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

export default async function OpengraphImage() {
  const logo = await logoDataUri();
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(90% 90% at 50% 30%, #2a1418 0%, #0d0c0a 70%)",
        color: "#f3ece0",
      }}
    >
      {logo && <img src={logo} width={220} height={220} alt="" />}
      <div
        style={{
          marginTop: 28,
          fontSize: 92,
          fontWeight: 700,
          letterSpacing: "-0.01em",
        }}
      >
        Boots &rsquo;n&rsquo; Bandit
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 30,
          letterSpacing: "0.32em",
          color: "#c92f4d",
        }}
      >
        TATTOO STUDIO · WORKSOP
      </div>
    </div>,
    size,
  );
}

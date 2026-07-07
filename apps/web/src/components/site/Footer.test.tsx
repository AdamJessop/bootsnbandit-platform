import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { mergeShellSettings, STUDIO } from "@/lib/site-nav";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("renders the hardcoded fallbacks when no CMS settings are passed", () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).toContain(STUDIO.address);
    expect(html).toContain(STUDIO.hours);
    expect(html).toContain(STUDIO.phone);
    expect(html).toContain(STUDIO.instagram);
  });

  it("renders CMS-driven studio details when provided", () => {
    const studio = mergeShellSettings({
      addressLine: "1 New Row",
      city: "Worksop",
      postcode: "S80 9ZZ",
      hoursText: "Wed–Sun 11–7",
      phone: "01909 111 222",
      instagramUrl: "https://instagram.com/newhandle",
    });
    const html = renderToStaticMarkup(<Footer studio={studio} />);
    expect(html).toContain("1 New Row, Worksop, S80 9ZZ");
    expect(html).toContain("Wed–Sun 11–7");
    expect(html).toContain("01909 111 222");
    expect(html).toContain("https://instagram.com/newhandle");
    expect(html).not.toContain(STUDIO.address);
  });
});

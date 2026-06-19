import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileEditor } from "./ProfileEditor";

describe("ProfileEditor", () => {
  it("renders bio, socials, numeric rates and the style multiselect; status is read-only", () => {
    const html = renderToStaticMarkup(
      <ProfileEditor
        action={vi.fn()}
        values={{
          status: "CO_OWNER",
          bio: "Heritage tattooer",
          insta: "@sarah",
          headshot: "/uploads/s.png",
          hourlyRatePence: 9000,
          dayRatePence: 60000,
          selectedStyleIds: ["s1"],
          specials: ["Snakes"],
        }}
        styles={[
          { id: "s1", name: "Fine-line" },
          { id: "s2", name: "Bold" },
        ]}
      />,
    );
    expect(html).toContain("Heritage tattooer");
    expect(html).toContain("@sarah");
    // status label shown but not an editable enum input
    expect(html).toContain("Co-owner");
    // numeric £ inputs
    expect(html).toContain('name="hourlyRatePounds"');
    expect(html).toContain('value="90"');
    expect(html).toContain('name="dayRatePounds"');
    // style checkboxes bound to the TattooStyle list (checked one selected)
    expect(html).toContain('name="styleIds"');
    expect(html).toContain("Fine-line");
    expect(html).toContain("Bold");
    expect(html).toContain('name="headshot"');
    // legacy fields gone
    expect(html).not.toContain('name="rateText"');
    expect(html).not.toContain("Rate text");
  });
});

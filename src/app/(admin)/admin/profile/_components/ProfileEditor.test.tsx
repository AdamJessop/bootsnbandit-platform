import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileEditor } from "./ProfileEditor";

describe("ProfileEditor", () => {
  it("renders bio, socials and styles seeded from values", () => {
    const html = renderToStaticMarkup(
      <ProfileEditor
        action={vi.fn()}
        values={{
          bio: "Heritage tattooer",
          rateText: "£90/hr",
          insta: "@sarah",
          headshot: "/uploads/s.png",
          styles: ["Fineline", "Bold"],
          specials: ["Snakes"],
        }}
      />,
    );
    expect(html).toContain("Heritage tattooer");
    expect(html).toContain("@sarah");
    expect(html).toContain("Fineline, Bold");
    expect(html).toContain('name="headshot"');
  });
});

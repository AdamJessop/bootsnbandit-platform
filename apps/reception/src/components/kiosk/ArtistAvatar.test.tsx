import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ArtistAvatar, artistInitials } from "./ArtistAvatar";

describe("artistInitials", () => {
  it("takes the first letters of up to two name parts", () => {
    expect(artistInitials("Sarah")).toBe("S");
    expect(artistInitials("Joss Carter Smith")).toBe("JC");
  });
});

describe("ArtistAvatar", () => {
  it("renders the headshot image when present", () => {
    const html = renderToStaticMarkup(
      <ArtistAvatar
        artist={{ name: "Sarah", headshot: "/sarah.jpg", hue: "crimson" }}
        size={60}
      />,
    );
    expect(html).toContain("/sarah.jpg");
    expect(html).toContain("avatar-img");
  });

  it("falls back to initials on the hue disc", () => {
    const html = renderToStaticMarkup(
      <ArtistAvatar
        artist={{ name: "Joss Carter", headshot: null, hue: "plum" }}
      />,
    );
    expect(html).toContain("JC");
    expect(html).not.toContain("avatar-img");
  });
});

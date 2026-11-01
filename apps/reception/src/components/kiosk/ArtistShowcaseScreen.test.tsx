import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ArtistShowcaseScreen, ShowcaseLightbox } from "./ArtistShowcaseScreen";
import type {
  ArtistShowcase,
  BoardArtist,
  ShowcaseGalleryItem,
} from "./kiosk-logic";

const boardArtist: BoardArtist = {
  id: "a1",
  name: "Sarah",
  status: "CO_OWNER",
  tag: "Neo-traditional",
  headshot: null,
  hue: "crimson",
  hourlyRatePence: 9000,
  onLeave: false,
  checkedIn: true,
};

const showcase: ArtistShowcase = {
  artist: {
    id: "a1",
    name: "Sarah",
    status: "CO_OWNER",
    tag: "Neo-traditional",
    bio: "Bold linework and colour, ten years in the chair.",
    styles: ["Neo-traditional", "Blackwork"],
    specials: ["Cover-ups", "Large scale"],
    insta: "@sarah.ink",
    experience: "10 years",
    headshot: null,
    hue: "crimson",
  },
  gallery: [
    {
      id: "g1",
      title: "Wolf sleeve",
      style: "Blackwork",
      placement: "Forearm",
      image: "https://example.com/wolf.jpg",
      hue: "crimson",
      featured: true,
    },
    {
      id: "g2",
      title: "Rose",
      style: null,
      placement: null,
      image: "https://example.com/rose.jpg",
      hue: "crimson",
      featured: false,
    },
  ],
};

describe("ArtistShowcaseScreen", () => {
  it("shows a loading hint while showcase data has not arrived", () => {
    const html = renderToStaticMarkup(
      <ArtistShowcaseScreen
        artist={boardArtist}
        showcase={null}
        onExit={() => {}}
      />,
    );
    expect(html).toContain("Sarah");
    expect(html).toContain("Co-owner");
    expect(html).toContain("Loading portfolio");
  });

  it("renders hero fields, tags, meta and gallery once loaded", () => {
    const html = renderToStaticMarkup(
      <ArtistShowcaseScreen
        artist={boardArtist}
        showcase={showcase}
        onExit={() => {}}
      />,
    );
    // hero
    expect(html).toContain("Sarah");
    expect(html).toContain("Co-owner");
    expect(html).toContain("10 years");
    expect(html).toContain("Bold linework and colour, ten years in the chair.");
    expect(html).toContain("Neo-traditional");
    // styles + specialisms pills
    expect(html).toContain("Styles");
    expect(html).toContain("Blackwork");
    expect(html).toContain("Specialisms");
    expect(html).toContain("Cover-ups");
    expect(html).toContain("Large scale");
    expect(html).toContain('class="rk-showcase-tag"');
    // insta as plain text, not a link
    expect(html).toContain("@sarah.ink");
    expect(html).not.toContain("<a ");
    // meta: only real numbers — the uploaded portfolio count
    expect(html).toContain("2 pieces in the portfolio");
    // gallery tiles + captions
    expect(html).toContain("Wolf sleeve");
    expect(html).toContain("Forearm");
    expect(html).toContain("Rose");
    expect(html).toContain('<button class="rk-showcase-tile featured"');
    expect(html).not.toContain("Loading portfolio");
  });

  it("says plainly when no photos are uploaded, with no piece count", () => {
    const html = renderToStaticMarkup(
      <ArtistShowcaseScreen
        artist={boardArtist}
        showcase={{ ...showcase, gallery: [] }}
        onExit={() => {}}
      />,
    );
    expect(html).toContain("No photos uploaded here yet");
    expect(html).toContain("ask Sarah to show you their book");
    expect(html).not.toContain("coming soon");
    expect(html).not.toContain("in the portfolio");
  });

  it("renders uploaded /media gallery images (served by the kiosk's own /media route)", () => {
    const html = renderToStaticMarkup(
      <ArtistShowcaseScreen
        artist={boardArtist}
        showcase={{
          ...showcase,
          gallery: [{ ...showcase.gallery[0], image: "/media/abc123" }],
        }}
        onExit={() => {}}
      />,
    );
    expect(html).toContain('src="/media/abc123"');
    expect(html).toContain("1 piece in the portfolio");
  });

  it("omits the styles/specialisms sections when empty", () => {
    const html = renderToStaticMarkup(
      <ArtistShowcaseScreen
        artist={boardArtist}
        showcase={{
          ...showcase,
          artist: { ...showcase.artist, styles: [], specials: [] },
        }}
        onExit={() => {}}
      />,
    );
    expect(html).not.toContain("Styles");
    expect(html).not.toContain("Specialisms");
  });
});

describe("ShowcaseLightbox", () => {
  const item: ShowcaseGalleryItem = {
    id: "g1",
    title: "Wolf sleeve",
    style: "Blackwork",
    placement: "Forearm",
    image: "https://example.com/wolf.jpg",
    hue: "crimson",
    featured: true,
  };

  it("renders nothing when there is no item", () => {
    const html = renderToStaticMarkup(
      <ShowcaseLightbox item={null} onClose={() => {}} />,
    );
    expect(html).toBe("");
  });

  it("renders the enlarged image and caption when open", () => {
    const html = renderToStaticMarkup(
      <ShowcaseLightbox item={item} onClose={() => {}} />,
    );
    expect(html).toContain("rk-lightbox");
    expect(html).toContain("https://example.com/wolf.jpg");
    expect(html).toContain("Wolf sleeve");
    expect(html).toContain("Blackwork");
    expect(html).toContain("Forearm");
  });
});

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import StaffError from "./error";
import GlobalError from "../global-error";

vi.mock("../globals.css", () => ({}));

describe("StaffError (staff error boundary)", () => {
  it("shows a friendly message, a Try again button and a way home", () => {
    const html = renderToStaticMarkup(
      <StaffError error={new Error("db down")} reset={vi.fn()} />,
    );
    expect(html).toContain("That didn&#x27;t work");
    expect(html).toContain("Try again");
    expect(html).toContain('href="/"');
    expect(html).toContain("Back to dashboard");
    // Never leak the raw server error to staff.
    expect(html).not.toContain("db down");
  });

  it("quotes the digest so staff can report it", () => {
    const err = Object.assign(new Error("x"), { digest: "abc123" });
    const html = renderToStaticMarkup(
      <StaffError error={err} reset={vi.fn()} />,
    );
    expect(html).toContain("abc123");
  });
});

describe("GlobalError (root error boundary)", () => {
  it("renders its own document with Try again + dashboard link", () => {
    const html = renderToStaticMarkup(
      <GlobalError error={new Error("layout broke")} reset={vi.fn()} />,
    );
    expect(html).toContain("<html");
    expect(html).toContain("Try again");
    expect(html).toContain('href="/"');
    expect(html).not.toContain("layout broke");
  });
});

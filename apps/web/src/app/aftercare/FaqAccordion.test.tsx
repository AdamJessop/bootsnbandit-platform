import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./aftercare.module.css", () => ({ default: {} }));

import { FaqAccordion } from "./FaqAccordion";

describe("FaqAccordion", () => {
  it("renders each question; the first answer is expanded by default", () => {
    const html = renderToStaticMarkup(
      <FaqAccordion
        faqs={[
          { id: "1", question: "Does it hurt?", answer: "A bit." },
          { id: "2", question: "How old?", answer: "18+." },
        ]}
      />,
    );
    expect(html).toContain("Does it hurt?");
    expect(html).toContain("How old?");
    expect(html).toContain("A bit."); // first item open
  });
});

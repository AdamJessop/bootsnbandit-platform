import { describe, expect, it, vi } from "vitest";

vi.mock("@bnb/core/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("./FrontDeskClient", () => ({ FrontDeskClient: () => null }));
vi.mock("./data", () => ({ loadDeskArtists: vi.fn() }));
vi.mock("../calendar/data", () => ({ loadCustomerOptions: vi.fn() }));

import FrontDeskPage from "./page";

describe("FrontDeskPage", () => {
  it("is an async server component", () => {
    expect(typeof FrontDeskPage).toBe("function");
  });
});

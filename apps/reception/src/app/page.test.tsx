import { describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();
const loadReceptionBoard = vi.fn();
vi.mock("@bnb/core/auth", () => ({
  requireRole: () => requireRole(),
}));
vi.mock("@bnb/core/services/reception", async () => {
  const actual = await vi.importActual<
    typeof import("@bnb/core/services/reception")
  >("@bnb/core/services/reception");
  return { ...actual, loadReceptionBoard: () => loadReceptionBoard() };
});
vi.mock("./actions", () => ({
  toggleStaffAction: vi.fn(),
  customerCheckinAction: vi.fn(),
  walkInAction: vi.fn(),
  checkoutAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { renderToStaticMarkup } from "react-dom/server";
import Page from "./page";

describe("reception home page", () => {
  it("requires a signed-in staff user and renders the kiosk board", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "OWNER" });
    loadReceptionBoard.mockResolvedValue({ artists: [], sessions: [] });

    const el = await Page();
    const html = renderToStaticMarkup(el);

    expect(requireRole).toHaveBeenCalled();
    expect(loadReceptionBoard).toHaveBeenCalled();
    expect(html).toContain("Front Desk");
    expect(html).toContain("Customer check-in");
  });

  it("propagates the sign-in redirect when unauthenticated", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
    // Board data is never loaded for a signed-out kiosk.
  });
});

import { describe, expect, it, vi } from "vitest";
import { signOut } from "./sign-out";

describe("signOut", () => {
  it("POSTs /api/auth/logout then navigates to /sign-in", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }));
    const navigate = vi.fn();
    await signOut({ fetchFn, navigate });
    expect(fetchFn).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    });
    expect(navigate).toHaveBeenCalledWith("/sign-in");
  });

  it("still navigates to /sign-in when the logout call fails", async () => {
    // Even if the network call fails, send the user to the sign-in screen —
    // requireRole() will bounce them straight back if the session survived.
    const fetchFn = vi.fn(async () => {
      throw new Error("offline");
    });
    const navigate = vi.fn();
    await signOut({ fetchFn, navigate });
    expect(navigate).toHaveBeenCalledWith("/sign-in");
  });
});

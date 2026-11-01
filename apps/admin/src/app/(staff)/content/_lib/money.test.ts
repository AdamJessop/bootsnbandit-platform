import { describe, expect, it } from "vitest";
import { formatPounds, penceToPounds, poundsToPence } from "./money";

describe("money helpers", () => {
  it("parses pounds strings to integer pence", () => {
    expect(poundsToPence("45")).toBe(4500);
    expect(poundsToPence("45.5")).toBe(4550);
    expect(poundsToPence(" 45.555 ")).toBe(4556);
    expect(poundsToPence("")).toBeNull();
    expect(poundsToPence("abc")).toBeNull();
    expect(poundsToPence(null)).toBeNull();
  });

  it("formats pence as a pounds input value (no symbol)", () => {
    expect(penceToPounds(4500)).toBe("45");
    expect(penceToPounds(4550)).toBe("45.50");
    expect(penceToPounds(null)).toBe("");
  });

  it("formats pence for display with a £ and a dash when unset", () => {
    expect(formatPounds(13000)).toBe("£130");
    expect(formatPounds(9999)).toBe("£99.99");
    expect(formatPounds(null)).toBe("—");
  });
});

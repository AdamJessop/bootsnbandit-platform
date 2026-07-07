import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NewCustomerFields } from "./NewCustomerFields";

const state = {
  newCustomerName: "Robin Vale",
  newCustomerDob: "1990-04-12",
  newCustomerEmail: "robin@example.com",
};

describe("NewCustomerFields", () => {
  it("renders name, DOB (date input) and email fields with values", () => {
    const html = renderToStaticMarkup(
      <NewCustomerFields state={state} errors={{}} onChange={vi.fn()} />,
    );
    expect(html).toContain('value="Robin Vale"');
    expect(html).toContain('type="date"');
    expect(html).toContain('value="1990-04-12"');
    expect(html).toContain('type="email"');
    expect(html).toContain('value="robin@example.com"');
  });

  it("renders inline field errors", () => {
    const html = renderToStaticMarkup(
      <NewCustomerFields
        state={{
          newCustomerName: "",
          newCustomerDob: "",
          newCustomerEmail: "",
        }}
        errors={{
          newCustomerName: "Enter the customer's name.",
          newCustomerEmail: "Enter a valid email address.",
        }}
        onChange={vi.fn()}
      />,
    );
    expect(html).toContain("Enter the customer&#x27;s name.");
    expect(html).toContain("Enter a valid email address.");
  });
});

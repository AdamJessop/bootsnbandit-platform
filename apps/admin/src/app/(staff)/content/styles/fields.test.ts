import { describe, expect, it } from "vitest";
import { FIELDS, SPEC } from "./fields";

describe("styles CMS field config", () => {
  it("includes an example image field in the form config", () => {
    // The create/edit form is a client component that only renders once its
    // `editing` state is opened (via a click), which isn't exercisable under
    // renderToStaticMarkup + the node test environment. Assert on the field
    // config that drives the form instead — the same pattern CrudSection's
    // own tests use for buildDefaults().
    expect(FIELDS).toContainEqual(
      expect.objectContaining({
        name: "image",
        label: "Example image",
        type: "image",
      }),
    );
  });

  it("coerces image as a nullable string so clearing the field stores NULL", () => {
    expect(SPEC).toContainEqual({
      name: "image",
      kind: "string",
      nullable: true,
    });
  });
});

import { CustomAttributes } from "./custom-attributes";
import {
  CustomAttribute,
  emptyCustomAttributesDefinition,
  setAttributes,
} from "./definition";

const attr = (
  id: string,
  label: string,
  type: CustomAttribute["type"] = "text",
): CustomAttribute => ({ id, label, type });

describe("CustomAttributes", () => {
  it("resolves the attributes defined for a type with a null value", () => {
    const definition = setAttributes(
      emptyCustomAttributesDefinition(),
      "junction",
      [attr("ca-1", "Owner", "text"), attr("ca-2", "Age", "number")],
    );
    const customAttributes = new CustomAttributes(definition);

    expect(customAttributes.getAttributesFor(7, "junction")).toEqual([
      { id: "ca-1", type: "text", label: "Owner", value: null },
      { id: "ca-2", type: "number", label: "Age", value: null },
    ]);
  });

  it("returns an empty list when the type has no attributes", () => {
    const customAttributes = new CustomAttributes(
      emptyCustomAttributesDefinition(),
    );

    expect(customAttributes.getAttributesFor(7, "pipe")).toEqual([]);
  });
});

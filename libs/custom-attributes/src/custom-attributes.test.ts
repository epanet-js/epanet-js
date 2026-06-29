import { CustomAttributes } from "./custom-attributes";
import {
  CustomAttribute,
  emptyCustomAttributesDefinition,
  setAttributes,
} from "./definition";
import { emptyCustomAttributesData, setValue } from "./data";

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

  it("resolves injected values and defaults to null when absent", () => {
    const definition = setAttributes(
      emptyCustomAttributesDefinition(),
      "junction",
      [attr("ca-1", "Owner", "text"), attr("ca-2", "Age", "number")],
    );
    let data = emptyCustomAttributesData();
    data = setValue(data, 7, "ca-1", "Alice");
    data = setValue(data, 7, "ca-2", 42);
    const customAttributes = new CustomAttributes(definition, data);

    expect(customAttributes.getAttributesFor(7, "junction")).toEqual([
      { id: "ca-1", type: "text", label: "Owner", value: "Alice" },
      { id: "ca-2", type: "number", label: "Age", value: 42 },
    ]);
    expect(customAttributes.getAttributesFor(8, "junction")).toEqual([
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

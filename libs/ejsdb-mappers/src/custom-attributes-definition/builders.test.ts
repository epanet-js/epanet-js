import type {
  CustomAttribute,
  CustomAttributeAssetType,
  CustomAttributesDefinition,
} from "@epanet-js/custom-attributes";
import { buildCustomAttributesDefinition } from "./builders";
import { serializeCustomAttributesDefinition } from "./to-rows";

const attr = (
  id: string,
  label: string,
  type: CustomAttribute["type"] = "text",
): CustomAttribute => ({ id, label, type });

const definitionOf = (
  entries: Array<[CustomAttributeAssetType, CustomAttribute[]]>,
): CustomAttributesDefinition => {
  const definition: CustomAttributesDefinition = new Map();
  for (const [assetType, attributes] of entries) {
    definition.set(
      assetType,
      new Map(attributes.map((a): [string, CustomAttribute] => [a.id, a])),
    );
  }
  return definition;
};

describe("buildCustomAttributesDefinition", () => {
  it("returns an empty definition for null", () => {
    expect(buildCustomAttributesDefinition(null).size).toBe(0);
  });

  it("builds a nested map keyed by asset type and id", () => {
    const definition = buildCustomAttributesDefinition(
      JSON.stringify({
        pipe: [{ id: "custom-1", label: "Material", type: "text" }],
      }),
    );

    expect([...definition.get("pipe")!.values()]).toEqual([
      attr("custom-1", "Material"),
    ]);
  });

  it("throws on invalid JSON", () => {
    expect(() => buildCustomAttributesDefinition("{not json")).toThrow(
      /Custom attributes: data is not valid JSON/,
    );
  });

  it("throws when data does not match the schema", () => {
    expect(() =>
      buildCustomAttributesDefinition(
        JSON.stringify({ pipe: [{ id: "custom-1", label: "", type: "text" }] }),
      ),
    ).toThrow(/Custom attributes: data does not match schema/);
  });

  it("round-trips with the serializer", () => {
    const definition = definitionOf([
      ["pipe", [attr("custom-1", "Material")]],
      ["customerPoint", [attr("custom-2", "Owner")]],
    ]);

    const restored = buildCustomAttributesDefinition(
      serializeCustomAttributesDefinition(definition),
    );

    expect([...restored.get("pipe")!.values()]).toEqual([
      attr("custom-1", "Material"),
    ]);
    expect([...restored.get("customerPoint")!.values()]).toEqual([
      attr("custom-2", "Owner"),
    ]);
  });
});

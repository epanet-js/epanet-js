import type {
  CustomAttribute,
  CustomAttributeAssetType,
  CustomAttributesDefinition,
} from "@epanet-js/custom-attributes";
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

describe("serializeCustomAttributesDefinition", () => {
  it("serializes the definition map to a JSON object keyed by asset type", () => {
    const definition = definitionOf([["pipe", [attr("ca-1", "Material")]]]);

    expect(JSON.parse(serializeCustomAttributesDefinition(definition))).toEqual(
      {
        pipe: [{ id: "ca-1", label: "Material", type: "text" }],
      },
    );
  });

  it("serializes an empty definition to an empty object", () => {
    expect(
      JSON.parse(serializeCustomAttributesDefinition(definitionOf([]))),
    ).toEqual({});
  });

  it("omits asset types with no attributes", () => {
    const definition = definitionOf([["pipe", []]]);

    expect(JSON.parse(serializeCustomAttributesDefinition(definition))).toEqual(
      {},
    );
  });

  it("throws when a label exceeds the maximum length", () => {
    const definition = definitionOf([["pipe", [attr("ca-1", "x".repeat(51))]]]);

    expect(() => serializeCustomAttributesDefinition(definition)).toThrow(
      /Custom attributes: data does not match schema/,
    );
  });
});

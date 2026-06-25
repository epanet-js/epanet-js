import { describe, it, expect } from "vitest";
import { AssetType } from "@epanet-js/hydraulic-model";
import {
  CustomAttribute,
  CustomAttributesDefinition,
  emptyCustomAttributesDefinition,
  getAttributes,
  setAttributes,
} from "./definition";

const attr = (
  id: string,
  label: string,
  type: CustomAttribute["type"] = "text",
): CustomAttribute => ({ id, label, type });

const withAttributes = (
  entries: Partial<Record<AssetType, CustomAttribute[]>>,
): CustomAttributesDefinition => {
  let definition = emptyCustomAttributesDefinition();
  for (const [assetType, attributes] of Object.entries(entries)) {
    definition = setAttributes(
      definition,
      assetType as AssetType,
      attributes ?? [],
    );
  }
  return definition;
};

describe("setAttributes", () => {
  it("stores attributes keyed by id", () => {
    const definition = setAttributes(
      emptyCustomAttributesDefinition(),
      "pipe",
      [attr("ca-7", "Diameter")],
    );

    expect(definition.get("pipe")?.get("ca-7")).toEqual(
      attr("ca-7", "Diameter"),
    );
  });

  it("replaces the attributes of the given asset type only", () => {
    const definition = withAttributes({
      pipe: [attr("ca-1", "Diameter")],
      junction: [attr("ca-2", "Owner")],
    });

    const updated = setAttributes(definition, "pipe", [
      attr("ca-3", "Material"),
    ]);

    expect(getAttributes(updated, "pipe").map((a) => a.label)).toEqual([
      "Material",
    ]);
    expect(getAttributes(updated, "junction").map((a) => a.label)).toEqual([
      "Owner",
    ]);
  });

  it("does not mutate the source definition", () => {
    const definition = withAttributes({ pipe: [attr("ca-1", "Diameter")] });

    setAttributes(definition, "pipe", [attr("ca-2", "Material")]);

    expect(getAttributes(definition, "pipe").map((a) => a.label)).toEqual([
      "Diameter",
    ]);
  });

  it("collapses duplicate ids keeping the last one", () => {
    const definition = setAttributes(
      emptyCustomAttributesDefinition(),
      "pipe",
      [attr("ca-1", "First"), attr("ca-1", "Second")],
    );

    expect(getAttributes(definition, "pipe")).toEqual([attr("ca-1", "Second")]);
  });
});

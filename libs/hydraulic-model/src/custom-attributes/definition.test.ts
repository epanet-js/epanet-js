import type { AssetType } from "../asset-types/types";
import {
  CustomAttribute,
  CustomAttributesDefinition,
  duplicateLabelKeys,
  emptyCustomAttributesDefinition,
  getAttribute,
  getAttributeIds,
  getAttributes,
  hasDuplicateLabel,
  hasTooLongLabel,
  MAX_LABEL_LENGTH,
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
      [attr("custom-7", "Diameter")],
    );

    expect(definition.get("pipe")?.get("custom-7")).toEqual(
      attr("custom-7", "Diameter"),
    );
  });

  it("replaces the attributes of the given asset type only", () => {
    const definition = withAttributes({
      pipe: [attr("custom-1", "Diameter")],
      junction: [attr("custom-2", "Owner")],
    });

    const updated = setAttributes(definition, "pipe", [
      attr("custom-3", "Material"),
    ]);

    expect(getAttributes(updated, "pipe").map((a) => a.label)).toEqual([
      "Material",
    ]);
    expect(getAttributes(updated, "junction").map((a) => a.label)).toEqual([
      "Owner",
    ]);
  });

  it("does not mutate the source definition", () => {
    const definition = withAttributes({ pipe: [attr("custom-1", "Diameter")] });

    setAttributes(definition, "pipe", [attr("custom-2", "Material")]);

    expect(getAttributes(definition, "pipe").map((a) => a.label)).toEqual([
      "Diameter",
    ]);
  });

  it("collapses duplicate ids keeping the last one", () => {
    const definition = setAttributes(
      emptyCustomAttributesDefinition(),
      "pipe",
      [attr("custom-1", "First"), attr("custom-1", "Second")],
    );

    expect(getAttributes(definition, "pipe")).toEqual([
      attr("custom-1", "Second"),
    ]);
  });
});

describe("hasDuplicateLabel", () => {
  it("detects duplicates ignoring case and surrounding whitespace", () => {
    expect(
      hasDuplicateLabel([
        attr("custom-1", "Diameter"),
        attr("custom-2", " diameter "),
      ]),
    ).toBe(true);
  });

  it("ignores empty labels", () => {
    expect(
      hasDuplicateLabel([attr("custom-1", "   "), attr("custom-2", "")]),
    ).toBe(false);
  });

  it("returns false for distinct labels", () => {
    expect(
      hasDuplicateLabel([
        attr("custom-1", "Diameter"),
        attr("custom-2", "Material"),
      ]),
    ).toBe(false);
  });
});

describe("hasTooLongLabel", () => {
  it("returns false for a label at the maximum length", () => {
    expect(
      hasTooLongLabel([attr("custom-1", "a".repeat(MAX_LABEL_LENGTH))]),
    ).toBe(false);
  });

  it("returns true for a label over the maximum length", () => {
    expect(
      hasTooLongLabel([attr("custom-1", "a".repeat(MAX_LABEL_LENGTH + 1))]),
    ).toBe(true);
  });

  it("trims surrounding whitespace before measuring", () => {
    expect(
      hasTooLongLabel([
        attr("custom-1", `  ${"a".repeat(MAX_LABEL_LENGTH)}  `),
      ]),
    ).toBe(false);
  });
});

describe("duplicateLabelKeys", () => {
  it("returns the normalized keys that appear more than once", () => {
    const keys = duplicateLabelKeys([
      attr("custom-1", "Diameter"),
      attr("custom-2", "DIAMETER "),
      attr("custom-3", "Material"),
    ]);

    expect([...keys]).toEqual(["diameter"]);
  });
});

describe("getAttributeIds", () => {
  it("returns every attribute id flattened across asset types", () => {
    const definition = withAttributes({
      pipe: [attr("custom-1", "Diameter"), attr("custom-2", "Material")],
      junction: [attr("custom-3", "Elevation")],
    });

    expect(getAttributeIds(definition)).toEqual(
      new Set(["custom-1", "custom-2", "custom-3"]),
    );
  });

  it("returns an empty set for an empty definition", () => {
    expect(getAttributeIds(emptyCustomAttributesDefinition())).toEqual(
      new Set(),
    );
  });
});

describe("getAttribute", () => {
  it("returns the attribute matching the asset type and id", () => {
    const definition = withAttributes({
      pipe: [attr("custom-1", "Diameter"), attr("custom-2", "Material")],
      junction: [attr("custom-1", "Elevation")],
    });

    expect(getAttribute(definition, "pipe", "custom-2")).toEqual(
      attr("custom-2", "Material"),
    );
  });

  it("returns undefined when the id belongs to another asset type", () => {
    const definition = withAttributes({
      pipe: [attr("custom-1", "Diameter")],
      junction: [attr("custom-2", "Elevation")],
    });

    expect(getAttribute(definition, "pipe", "custom-2")).toBeUndefined();
  });

  it("returns undefined for an unknown asset type", () => {
    const definition = withAttributes({ pipe: [attr("custom-1", "Diameter")] });

    expect(getAttribute(definition, "junction", "custom-1")).toBeUndefined();
  });
});

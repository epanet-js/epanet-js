import { describe, expect, it } from "vitest";
import { customAttributesDefinitionSchema } from "./custom-attributes-definition";

describe("customAttributesDefinitionSchema", () => {
  it("accepts a valid record keyed by asset type", () => {
    const data = {
      pipe: [{ id: "ca-1", label: "Material", type: "text" }],
      pump: [{ id: "ca-2", label: "Cost", type: "number" }],
    };
    expect(customAttributesDefinitionSchema.parse(data)).toEqual(data);
  });

  it("accepts an empty object", () => {
    expect(customAttributesDefinitionSchema.parse({})).toEqual({});
  });

  it("rejects an unknown attribute type", () => {
    const result = customAttributesDefinitionSchema.safeParse({
      pipe: [{ id: "ca-1", label: "Material", type: "boolean" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty or whitespace-only label", () => {
    expect(
      customAttributesDefinitionSchema.safeParse({
        pipe: [{ id: "ca-1", label: "   ", type: "text" }],
      }).success,
    ).toBe(false);
  });

  it("rejects a label longer than 50 characters", () => {
    const result = customAttributesDefinitionSchema.safeParse({
      pipe: [{ id: "ca-1", label: "x".repeat(51), type: "text" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a label of exactly 50 characters", () => {
    const result = customAttributesDefinitionSchema.safeParse({
      pipe: [{ id: "ca-1", label: "x".repeat(50), type: "text" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown asset type key", () => {
    const result = customAttributesDefinitionSchema.safeParse({
      sensor: [{ id: "ca-1", label: "Material", type: "text" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty id", () => {
    const result = customAttributesDefinitionSchema.safeParse({
      pipe: [{ id: "", label: "Material", type: "text" }],
    });
    expect(result.success).toBe(false);
  });
});

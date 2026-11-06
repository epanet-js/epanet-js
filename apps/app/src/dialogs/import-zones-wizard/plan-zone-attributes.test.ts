import { describe, expect, it } from "vitest";
import {
  MAX_LABEL_LENGTH,
  emptyCustomAttributesDefinition,
  getAttributes,
  setAttributes,
} from "@epanet-js/hydraulic-model";
import { planZoneAttributes } from "./plan-zone-attributes";

describe("planZoneAttributes", () => {
  it("adds a zone attribute per imported column", () => {
    const { definition, plan } = planZoneAttributes(
      emptyCustomAttributesDefinition(),
      [
        { ref: "AREA", name: "AREA", type: "text" },
        { ref: "POP", name: "POP", type: "number" },
      ],
    );

    expect(getAttributes(definition, "zone")).toEqual([
      { id: "custom-1", label: "AREA", type: "text" },
      { id: "custom-2", label: "POP", type: "number" },
    ]);
    expect(plan.get("AREA")).toEqual({ id: "custom-1", type: "text" });
    expect(plan.get("POP")).toEqual({ id: "custom-2", type: "number" });
  });

  it("keeps the existing zone attributes and reuses one with the same name", () => {
    const existing = setAttributes(emptyCustomAttributesDefinition(), "zone", [
      { id: "custom-1", label: "Area", type: "text" },
      { id: "custom-2", label: "Owner", type: "text" },
    ]);

    const { definition, plan } = planZoneAttributes(existing, [
      { ref: "AREA", name: "AREA", type: "number" },
      { ref: "POP", name: "POP", type: "number" },
    ]);

    expect(getAttributes(definition, "zone")).toEqual([
      { id: "custom-1", label: "Area", type: "text" },
      { id: "custom-2", label: "Owner", type: "text" },
      { id: "custom-3", label: "POP", type: "number" },
    ]);
    expect(plan.get("AREA")).toEqual({ id: "custom-1", type: "text" });
  });

  it("imports columns whose names differ only in case as one attribute", () => {
    const { definition, plan } = planZoneAttributes(
      emptyCustomAttributesDefinition(),
      [
        { ref: "Area", name: "Area", type: "text" },
        { ref: "AREA", name: "AREA", type: "text" },
      ],
    );

    expect(getAttributes(definition, "zone")).toEqual([
      { id: "custom-1", label: "Area", type: "text" },
    ]);
    expect(plan.get("AREA")).toEqual({ id: "custom-1", type: "text" });
  });

  it("shortens a column name past the label limit", () => {
    const name = "A".repeat(MAX_LABEL_LENGTH + 10);

    const { definition, plan } = planZoneAttributes(
      emptyCustomAttributesDefinition(),
      [{ ref: name, name, type: "text" }],
    );

    expect(getAttributes(definition, "zone")).toEqual([
      { id: "custom-1", label: "A".repeat(MAX_LABEL_LENGTH), type: "text" },
    ]);
    expect(plan.get(name)).toEqual({ id: "custom-1", type: "text" });
  });

  it("skips a column with a blank name", () => {
    const { definition, plan } = planZoneAttributes(
      emptyCustomAttributesDefinition(),
      [{ ref: " ", name: " ", type: "text" }],
    );

    expect(getAttributes(definition, "zone")).toEqual([]);
    expect(plan.size).toBe(0);
  });

  it("draws new ids past those used by any element type", () => {
    const existing = setAttributes(
      emptyCustomAttributesDefinition(),
      "junction",
      [{ id: "custom-4", label: "Owner", type: "text" }],
    );

    const { plan } = planZoneAttributes(existing, [
      { ref: "AREA", name: "AREA", type: "text" },
    ]);

    expect(plan.get("AREA")!.id).toBe("custom-5");
  });
});

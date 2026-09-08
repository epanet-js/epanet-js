import { describe, expect, it } from "vitest";

import { schemaForField } from "./fields";

const accepts = (
  entity: Parameters<typeof schemaForField>[0],
  field: string,
  value: unknown,
) => schemaForField(entity, field)!.safeParse(value).success;

describe("schemaForField", () => {
  it("rejects a string where the model has a number", () => {
    expect(accepts("pipe", "diameter", 300)).toBe(true);
    expect(accepts("pipe", "diameter", "300")).toBe(false);
  });

  it("rejects non-finite numbers", () => {
    expect(accepts("junction", "elevation", NaN)).toBe(false);
    expect(accepts("junction", "elevation", Infinity)).toBe(false);
    expect(accepts("junction", "elevation", -Infinity)).toBe(false);
  });

  it("allows null only where the model allows it", () => {
    expect(accepts("pipe", "diameter", null)).toBe(true);
    expect(accepts("pipe", "minorLoss", null)).toBe(false);
    expect(accepts("pipe", "label", null)).toBe(false);
  });

  it("checks enum membership", () => {
    expect(accepts("pipe", "initialStatus", "cv")).toBe(true);
    expect(accepts("pipe", "initialStatus", "active")).toBe(false);
    expect(accepts("valve", "initialStatus", "active")).toBe(true);
    expect(accepts("valve", "kind", "prv")).toBe(true);
    expect(accepts("valve", "kind", "xyz")).toBe(false);
  });

  it("checks geometry shape", () => {
    expect(accepts("junction", "coordinates", [1, 2])).toBe(true);
    expect(accepts("junction", "coordinates", [1])).toBe(false);
    expect(
      accepts("pipe", "coordinates", [
        [0, 0],
        [10, 0],
      ]),
    ).toBe(true);
    expect(accepts("pipe", "coordinates", [[0, 0]])).toBe(false);
    expect(
      accepts("pipe", "coordinates", [
        [0, NaN],
        [10, 0],
      ]),
    ).toBe(false);
  });

  it("covers the fields that carry no column", () => {
    expect(accepts("junction", "at", "a0")).toBe(true);
    expect(accepts("junction", "visibility", true)).toBe(true);
  });

  it("matches custom attributes by prefix", () => {
    expect(accepts("junction", "custom-1", "north")).toBe(true);
    expect(accepts("junction", "custom-1", 42)).toBe(true);
    expect(accepts("junction", "custom-1", null)).toBe(true);
    expect(accepts("junction", "custom-1", NaN)).toBe(false);
  });

  it("has no schema for an unknown field", () => {
    expect(schemaForField("junction", "somethingNew")).toBeUndefined();
  });
});

describe("whole-value cells", () => {
  const whole = (
    entity: Parameters<typeof schemaForField>[0],
    value: unknown,
  ) => schemaForField(entity, "$value")!.safeParse(value).success;

  it("checks a control list", () => {
    const control = {
      id: "c1",
      type: "timed-setting",
      linkId: 3,
      steps: [{ time: 0, status: "on", setting: 1 }],
    };
    expect(whole("allControls", [control])).toBe(true);
    expect(whole("allControls", [])).toBe(true);
    expect(whole("allControls", [{ ...control, type: "made-up" }])).toBe(false);
    expect(whole("allControls", [{ ...control, linkId: "3" }])).toBe(false);
  });

  it("checks the pipe library", () => {
    const material = {
      label: "DUCTILE_IRON",
      entries: [{ age: 10, roughness: 130 }],
    };
    expect(whole("pipeLibrary", [material])).toBe(true);
    expect(whole("pipeLibrary", [{ ...material, label: 42 }])).toBe(false);
  });

  it("checks raw controls", () => {
    expect(whole("rawControls", { simple: [], rules: [] })).toBe(true);
    expect(whole("rawControls", { simple: [] })).toBe(false);
  });

  it("checks a demand list", () => {
    expect(whole("junctionDemand", [])).toBe(true);
    expect(whole("junctionDemand", [{ baseDemand: 5, patternId: 21 }])).toBe(
      true,
    );
    expect(whole("junctionDemand", [{ baseDemand: 5 }])).toBe(true);
    expect(whole("junctionDemand", [{ baseDemand: 5, patternId: null }])).toBe(
      true,
    );
    expect(whole("junctionDemand", [{ baseDemand: NaN }])).toBe(false);
    expect(whole("junctionDemand", [{ baseDemand: Infinity }])).toBe(false);
    expect(whole("customerDemand", [{ baseDemand: 1 }])).toBe(true);
  });

  it("checks the flattened custom-attributes definition", () => {
    const attribute = { id: "a1", label: "DIAMETER", type: "text" };
    expect(whole("customAttributesDefinition", {})).toBe(true);
    expect(
      whole("customAttributesDefinition", { "junction/a1": attribute }),
    ).toBe(true);
    expect(whole("customAttributesDefinition", { "nope/a1": attribute })).toBe(
      false,
    );
    expect(
      whole("customAttributesDefinition", { "junction/a1": { id: "a1" } }),
    ).toBe(false);
  });
});

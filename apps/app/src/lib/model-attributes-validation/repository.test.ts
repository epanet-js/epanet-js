import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { rulesFor, firstFailure, fieldValidator } from "./repository";
import { ValidatableEntity } from "./types";

const emptyModel = HydraulicModelBuilder.with().build();

describe("rulesFor", () => {
  it("returns a field's rules in run order (presence before sign)", () => {
    const ids = rulesFor("pipe", "roughness").map((rule) => rule.id);
    expect(ids).toEqual(["pipe.roughness.present", "pipe.roughness.positive"]);
  });

  it("returns only the presence rule for a present-only field", () => {
    const ids = rulesFor("reservoir", "head").map((rule) => rule.id);
    expect(ids).toEqual(["reservoir.head.present"]);
  });

  it("narrows to a single field, and lists the whole entity type otherwise", () => {
    expect(rulesFor("pipe", "length").map((r) => r.id)).toEqual([
      "pipe.length.present",
      "pipe.length.positive",
    ]);
    expect(rulesFor("pipe").length).toBeGreaterThan(
      rulesFor("pipe", "length").length,
    );
  });
});

describe("firstFailure", () => {
  const model = emptyModel;
  const entityWith = (fields: Record<string, unknown>): ValidatableEntity =>
    fields as unknown as ValidatableEntity;

  it("reports the first failing rule in order (required before positive)", () => {
    const rules = rulesFor("pipe", "roughness");
    expect(
      firstFailure(rules, entityWith({ roughness: null }), model)?.id,
    ).toBe("pipe.roughness.present");
    expect(firstFailure(rules, entityWith({ roughness: 0 }), model)?.id).toBe(
      "pipe.roughness.positive",
    );
    expect(
      firstFailure(rules, entityWith({ roughness: 120 }), model),
    ).toBeNull();
  });

  it("skips a rule whose appliesWhen is false", () => {
    const rules = rulesFor("tank", "maxLevel");
    // Curve-based tank: level rules do not apply.
    expect(
      firstFailure(rules, entityWith({ maxLevel: 0, volumeCurveId: 9 }), model),
    ).toBeNull();
    // Diameter-based tank: they do.
    expect(
      firstFailure(
        rules,
        entityWith({ maxLevel: 0, volumeCurveId: null }),
        model,
      )?.id,
    ).toBe("tank.maxLevel.positive");
  });
});

describe("fieldValidator", () => {
  it("composes a field's value checks", () => {
    expect(fieldValidator("pipe", "diameter")!(0)).toBe(false);
    expect(fieldValidator("pipe", "diameter")!(5)).toBe(true);
    expect(fieldValidator("tank", "initialLevel")!(0)).toBe(true);
    expect(fieldValidator("tank", "mixingFraction")!(1.5)).toBe(false);
  });

  it("validates the installation year", () => {
    const validate = fieldValidator("pipe", "year")!;
    expect(validate(2020)).toBe(true);
    expect(validate(1800)).toBe(true);
    expect(validate(800)).toBe(false);
  });

  it("resolves the newly-covered stored fields", () => {
    expect(fieldValidator("pipe", "length")!(0)).toBe(false);
    expect(fieldValidator("pump", "power")!(0)).toBe(false);
    expect(fieldValidator("tank", "maxLevel")!(0)).toBe(false);
    expect(fieldValidator("tank", "minLevel")!(-1)).toBe(false);
    expect(fieldValidator("tank", "minLevel")!(0)).toBe(true);
  });

  it("returns undefined for a field with no rules", () => {
    expect(fieldValidator("pump", "kind")).toBeUndefined();
  });

  it("gives presence-only fields a permissive validator (any number passes)", () => {
    const setting = fieldValidator("valve", "setting")!;
    expect(setting(5)).toBe(true);
    expect(setting(0)).toBe(true);
    expect(setting(-1)).toBe(true);
  });
});

// The repository is the single source both the UI (fieldValidator) and the
// pre-simulation check (firstFailure over fieldGroupsFor) read from.
describe("repository is the shared source", () => {
  it("exposes rules for every asset type it validates", () => {
    for (const entityType of ["pipe", "valve", "tank", "pump"] as const) {
      expect(rulesFor(entityType).length).toBeGreaterThan(0);
    }
  });
});

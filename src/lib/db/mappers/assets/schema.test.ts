import {
  junctionRowSchema,
  pipeRowSchema,
  pumpRowSchema,
  tankRowSchema,
  valveRowSchema,
} from "./schema";
import { junctionPatchRowSchema, pumpPatchRowSchema } from "./patches";

const validJunction = {
  id: 1,
  type: "junction" as const,
  label: "J1",
  is_active: 1 as const,
  coord_x: 0,
  coord_y: 0,
  elevation: null,
  initial_quality: null,
  chemical_source_type: null,
  chemical_source_strength: null,
  chemical_source_pattern_id: null,
  emitter_coefficient: null,
};

describe("asset row schemas", () => {
  it("rejects junction rows with is_active outside {0,1}", () => {
    const result = junctionRowSchema.safeParse({
      ...validJunction,
      is_active: 2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects pipe rows with an unknown initial_status", () => {
    const result = pipeRowSchema.safeParse({
      id: 1,
      type: "pipe",
      label: "P1",
      is_active: 1,
      start_node_id: 1,
      end_node_id: 2,
      coords: "[[0,0],[1,1]]",
      length: null,
      initial_status: "??",
      diameter: null,
      roughness: null,
      minor_loss: null,
      bulk_reaction_coeff: null,
      wall_reaction_coeff: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects pump rows with an unknown definition_type", () => {
    const result = pumpRowSchema.safeParse({
      id: 1,
      type: "pump",
      label: "PU1",
      is_active: 1,
      start_node_id: 1,
      end_node_id: 2,
      coords: "[[0,0],[1,1]]",
      length: null,
      initial_status: null,
      definition_type: "bogus",
      power: null,
      speed: null,
      speed_pattern_id: null,
      efficiency_curve_id: null,
      energy_price: null,
      energy_price_pattern_id: null,
      curve_id: null,
      curve_points: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects tank rows with an unknown mixing_model", () => {
    const result = tankRowSchema.safeParse({
      id: 1,
      type: "tank",
      label: "T1",
      is_active: 1,
      coord_x: 0,
      coord_y: 0,
      elevation: null,
      initial_quality: null,
      chemical_source_type: null,
      chemical_source_strength: null,
      chemical_source_pattern_id: null,
      initial_level: null,
      min_level: null,
      max_level: null,
      min_volume: null,
      diameter: null,
      overflow: null,
      mixing_model: "weird",
      mixing_fraction: null,
      bulk_reaction_coeff: null,
      volume_curve_id: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects valve rows with an unknown valve_kind", () => {
    const result = valveRowSchema.safeParse({
      id: 1,
      type: "valve",
      label: "V1",
      is_active: 1,
      start_node_id: 1,
      end_node_id: 2,
      coords: "[[0,0],[1,1]]",
      length: null,
      initial_status: null,
      diameter: null,
      minor_loss: null,
      valve_kind: "xyz",
      setting: null,
      curve_id: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects junction rows with a non-finite coordinate", () => {
    const result = junctionRowSchema.safeParse({
      ...validJunction,
      coord_x: NaN,
    });
    expect(result.success).toBe(false);
  });
});

describe("asset patch row schemas", () => {
  it("requires id but allows other columns to be omitted", () => {
    const result = junctionPatchRowSchema.safeParse({ id: 1, label: "X" });
    expect(result.success).toBe(true);
  });

  it("rejects a patch missing id", () => {
    const result = junctionPatchRowSchema.safeParse({ label: "X" });
    expect(result.success).toBe(false);
  });

  it("rejects a patch with a wrong-typed value for a known column", () => {
    const result = junctionPatchRowSchema.safeParse({ id: 1, is_active: 5 });
    expect(result.success).toBe(false);
  });

  it("rejects a pump patch with bogus definition_type", () => {
    const result = pumpPatchRowSchema.safeParse({
      id: 1,
      definition_type: "nope",
    });
    expect(result.success).toBe(false);
  });
});

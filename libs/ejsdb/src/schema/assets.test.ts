import {
  junctionRowSchema,
  pipeRowSchema,
  pumpRowSchema,
  tankRowSchema,
  valveRowSchema,
} from "./assets";

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

  const validPipe = {
    id: 1,
    label: "P1",
    is_active: 1 as const,
    start_node_id: 1,
    end_node_id: 2,
    coords: "[[0,0],[1,1]]",
    length: null,
    initial_status: "open" as const,
    diameter: null,
    roughness: null,
    minor_loss: null,
    bulk_reaction_coeff: null,
    wall_reaction_coeff: null,
    material: null,
    year: null,
  };

  it("rejects pipe rows with an unknown initial_status", () => {
    const result = pipeRowSchema.safeParse({
      ...validPipe,
      initial_status: "??",
    });
    expect(result.success).toBe(false);
  });

  it("accepts pipe rows with material and year set", () => {
    const result = pipeRowSchema.safeParse({
      ...validPipe,
      material: "PVC",
      year: 1995,
    });
    expect(result.success).toBe(true);
  });

  it("accepts pipe rows with material at the 200 character limit", () => {
    const result = pipeRowSchema.safeParse({
      ...validPipe,
      material: "a".repeat(200),
    });
    expect(result.success).toBe(true);
  });

  it("rejects pipe rows with material longer than 200 characters", () => {
    const result = pipeRowSchema.safeParse({
      ...validPipe,
      material: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("accepts pipe rows with year at the 1000 lower bound", () => {
    expect(pipeRowSchema.safeParse({ ...validPipe, year: 1000 }).success).toBe(
      true,
    );
  });

  it("accepts pipe rows with year at the 9999 upper bound", () => {
    expect(pipeRowSchema.safeParse({ ...validPipe, year: 9999 }).success).toBe(
      true,
    );
  });

  it("rejects pipe rows with a year below 1000", () => {
    expect(pipeRowSchema.safeParse({ ...validPipe, year: 999 }).success).toBe(
      false,
    );
  });

  it("rejects pipe rows with a year above 9999", () => {
    expect(pipeRowSchema.safeParse({ ...validPipe, year: 10000 }).success).toBe(
      false,
    );
  });

  it("rejects pipe rows with year 0", () => {
    expect(pipeRowSchema.safeParse({ ...validPipe, year: 0 }).success).toBe(
      false,
    );
  });

  it("rejects pipe rows with a negative year", () => {
    expect(pipeRowSchema.safeParse({ ...validPipe, year: -1 }).success).toBe(
      false,
    );
  });

  it("rejects pipe rows with non-integer year", () => {
    const result = pipeRowSchema.safeParse({ ...validPipe, year: 1995.5 });
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

  it("accepts all valid pump definition_type values including legacy curve", () => {
    const base = {
      id: 1,
      label: null,
      is_active: 1 as const,
      start_node_id: 1,
      end_node_id: 2,
      coords: "[[0,0],[1,1]]",
      length: null,
      initial_status: null,
      power: null,
      speed: null,
      speed_pattern_id: null,
      efficiency_curve_id: null,
      energy_price: null,
      energy_price_pattern_id: null,
      curve_id: null,
      curve_points: null,
    };

    for (const type of [
      "power",
      "designPointCurve",
      "standardCurve",
      "curveId",
    ]) {
      expect(
        pumpRowSchema.safeParse({ ...base, definition_type: type }).success,
      ).toBe(true);
    }
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

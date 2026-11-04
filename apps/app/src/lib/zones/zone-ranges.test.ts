import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import type { JunctionSimulation } from "@epanet-js/simulation";
import {
  activeJunctionIds,
  elevationRange,
  pressureRange,
} from "./zone-ranges";

const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 10, T1: 20 } as const;

const buildModel = () =>
  HydraulicModelBuilder.with()
    .aJunction(IDS.J1, { elevation: 12, coordinates: [0, 0] })
    .aJunction(IDS.J2, { elevation: 40, coordinates: [10, 0] })
    .aJunction(IDS.J3, { elevation: 5, coordinates: [20, 0], isActive: false })
    .aJunction(IDS.J4, { elevation: null, coordinates: [30, 0] })
    .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
    .aTank(IDS.T1, { elevation: 100, coordinates: [40, 0] })
    .build();

const resultsWith = (
  pressures: Record<number, { min: number; max: number }>,
) => ({
  getJunction: (id: number) =>
    pressures[id]
      ? ({
          minPressure: pressures[id].min,
          maxPressure: pressures[id].max,
        } as JunctionSimulation)
      : null,
});

describe("activeJunctionIds", () => {
  it("keeps only active junctions", () => {
    const model = buildModel();

    expect(
      activeJunctionIds(model, [IDS.J1, IDS.J2, IDS.J3, IDS.P1, IDS.T1]),
    ).toEqual([IDS.J1, IDS.J2]);
  });
});

describe("elevationRange", () => {
  it("returns the lowest and highest junction elevation", () => {
    const model = buildModel();

    expect(elevationRange(model, [IDS.J1, IDS.J2, IDS.J4])).toEqual({
      min: 12,
      max: 40,
    });
  });

  it("returns null when no junction has an elevation", () => {
    const model = buildModel();

    expect(elevationRange(model, [IDS.J4])).toBeNull();
    expect(elevationRange(model, [])).toBeNull();
  });
});

describe("pressureRange", () => {
  it("returns the lowest minimum and highest maximum pressure", () => {
    const results = resultsWith({
      [IDS.J1]: { min: 20, max: 45 },
      [IDS.J2]: { min: 15, max: 30 },
    });

    expect(pressureRange(results, [IDS.J1, IDS.J2])).toEqual({
      min: 15,
      max: 45,
    });
  });

  it("returns null without simulation results", () => {
    expect(pressureRange(null, [IDS.J1])).toBeNull();
    expect(pressureRange(resultsWith({}), [IDS.J1])).toBeNull();
  });
});

import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { createMockResultsReader } from "src/__helpers__/state";
import {
  getSortedDataForProperty,
  getSortedSimulationDataForBreaks,
} from "./symbology-data-source";

describe("getSortedDataForProperty", () => {
  const IDS = { P1: 1, P2: 2, P3: 3 } as const;

  const model = () =>
    HydraulicModelBuilder.with()
      .aPipe(IDS.P1, { roughness: 90, material: "Cast Iron" })
      .aPipe(IDS.P2, { roughness: null, material: "Cast Iron" })
      .aPipe(IDS.P3, { roughness: null, material: "PVC" })
      .aPipeMaterial({
        label: "Cast Iron",
        entries: [{ age: 0, roughness: 120 }],
      })
      .build();

  it("counts inferred values towards the breaks", () => {
    const data = getSortedDataForProperty("roughness", model(), null);

    expect(data).toEqual([90, 120]);
  });

  it("leaves other properties alone", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(IDS.P1, { diameter: 300 })
      .aPipe(IDS.P2, { diameter: 100 })
      .build();

    const data = getSortedDataForProperty("diameter", hydraulicModel, null);

    expect(data).toEqual([100, 300]);
  });
});

describe("simulation data for breaks", () => {
  const IDS = { J1: 1, J2: 2 } as const;

  it("combines every timestep's values, sorted", async () => {
    const timesteps = [
      createMockResultsReader({
        junctions: { [IDS.J1]: { pressure: 30 } },
      }),
      createMockResultsReader({
        junctions: { [IDS.J1]: { pressure: 10 }, [IDS.J2]: { pressure: 20 } },
      }),
    ];
    const epsReader = {
      timestepCount: timesteps.length,
      getResultsForTimestep: (t: number) => Promise.resolve(timesteps[t]),
    } as never;

    const data = await getSortedSimulationDataForBreaks("pressure", {
      mode: "allSteps",
      epsReader,
    });

    expect(data).toEqual([10, 20, 30]);
  });
});

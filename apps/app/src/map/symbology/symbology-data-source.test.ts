import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { getSortedDataForProperty } from "./symbology-data-source";

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
    const data = getSortedDataForProperty("roughness", model(), null, {
      inferRoughness: true,
    });

    expect(data).toEqual([90, 120]);
  });

  it("reads only stored values when inference is off", () => {
    const data = getSortedDataForProperty("roughness", model(), null);

    expect(data).toEqual([90]);
  });

  it("leaves other properties alone", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(IDS.P1, { diameter: 300 })
      .aPipe(IDS.P2, { diameter: 100 })
      .build();

    const data = getSortedDataForProperty("diameter", hydraulicModel, null, {
      inferRoughness: true,
    });

    expect(data).toEqual([100, 300]);
  });
});

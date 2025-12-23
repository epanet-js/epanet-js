import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Junction, Pipe, Reservoir } from "../asset-types";
import { changeProperty } from "./change-property";

describe("change property", () => {
  it("changes a property of an asset", () => {
    const IDS = { junctionID: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.junctionID, { elevation: 15 })
      .build();
    const { putAssets } = changeProperty(hydraulicModel, {
      assetIds: [IDS.junctionID],
      property: "elevation",
      value: 20,
    });

    expect(putAssets!.length).toEqual(1);
    const updatedJunction = putAssets![0] as Junction;
    expect(updatedJunction.id).toEqual(IDS.junctionID);
    expect(updatedJunction.elevation).toEqual(20);
  });

  it("can change properties of many assets", () => {
    const IDS = { A: 1, B: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { elevation: 15 })
      .aReservoir(IDS.B, { elevation: 35 })
      .build();
    const { putAssets } = changeProperty(hydraulicModel, {
      assetIds: [IDS.A, IDS.B],
      property: "elevation",
      value: 20,
    });

    expect(putAssets!.length).toEqual(2);
    const updatedA = putAssets![0] as Junction;
    expect(updatedA.id).toEqual(IDS.A);
    expect(updatedA.elevation).toEqual(20);

    const updatedB = putAssets![1] as Reservoir;
    expect(updatedB.id).toEqual(IDS.B);
    expect(updatedB.elevation).toEqual(20);
  });

  it("ignores assets that do not have the property provided", () => {
    const IDS = { A: 1, B: 2, PIPE: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.A)
      .aJunction(IDS.B)
      .aPipe(IDS.PIPE, { diameter: 10 })
      .build();
    const { putAssets } = changeProperty(hydraulicModel, {
      assetIds: [IDS.A, IDS.B, IDS.PIPE],
      property: "diameter",
      value: 20,
    });

    expect(putAssets!.length).toEqual(1);
    const updatedPipe = putAssets![0] as Pipe;
    expect(updatedPipe.id).toEqual(IDS.PIPE);
    expect(updatedPipe.diameter).toEqual(20);
  });

  it("silently ignores isActive property changes", () => {
    const IDS = { J1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .build();

    const { putAssets } = changeProperty(hydraulicModel, {
      assetIds: [IDS.J1],
      property: "isActive",
      value: false,
    });

    expect(putAssets).toHaveLength(0);
  });
});

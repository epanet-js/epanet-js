import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Junction, Pipe, Reservoir } from "../asset-types";
import { changeProperty } from "./change-property";

describe("change property", () => {
  it("changes a property of an asset", () => {
    const IDS = { junctionID: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.junctionID, { baseDemand: 15 })
      .build();
    const { putAssets } = changeProperty(hydraulicModel, {
      assetIds: [String(IDS.junctionID)],
      property: "baseDemand",
      value: 20,
    });

    expect(putAssets!.length).toEqual(1);
    const updatedJunction = putAssets![0] as Junction;
    expect(updatedJunction.id).toEqual(String(IDS.junctionID));
    expect(updatedJunction.baseDemand).toEqual(20);
  });

  it("can change properties of many assets", () => {
    const IDS = { A: 1, B: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { elevation: 15 })
      .aReservoir(IDS.B, { elevation: 35 })
      .build();
    const { putAssets } = changeProperty(hydraulicModel, {
      assetIds: [String(IDS.A), String(IDS.B)],
      property: "elevation",
      value: 20,
    });

    expect(putAssets!.length).toEqual(2);
    const updatedA = putAssets![0] as Junction;
    expect(updatedA.id).toEqual(String(IDS.A));
    expect(updatedA.elevation).toEqual(20);

    const updatedB = putAssets![1] as Reservoir;
    expect(updatedB.id).toEqual(String(IDS.B));
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
      assetIds: [String(IDS.A), String(IDS.B), String(IDS.PIPE)],
      property: "diameter",
      value: 20,
    });

    expect(putAssets!.length).toEqual(1);
    const updatedPipe = putAssets![0] as Pipe;
    expect(updatedPipe.id).toEqual(String(IDS.PIPE));
    expect(updatedPipe.diameter).toEqual(20);
  });
});

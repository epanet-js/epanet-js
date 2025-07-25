import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Junction, Pipe, Reservoir } from "../asset-types";
import { changeProperty } from "./change-property";

describe("change property", () => {
  it("changes a property of an asset", () => {
    const junctionId = "junctionID";
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(junctionId, { baseDemand: 15 })
      .build();
    const { putAssets } = changeProperty(hydraulicModel, {
      assetIds: [junctionId],
      property: "baseDemand",
      value: 20,
    });

    expect(putAssets!.length).toEqual(1);
    const updatedJunction = putAssets![0] as Junction;
    expect(updatedJunction.id).toEqual(junctionId);
    expect(updatedJunction.baseDemand).toEqual(20);
  });

  it("can change properties of many assets", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("A", { elevation: 15 })
      .aReservoir("B", { elevation: 35 })
      .build();
    const { putAssets } = changeProperty(hydraulicModel, {
      assetIds: ["A", "B"],
      property: "elevation",
      value: 20,
    });

    expect(putAssets!.length).toEqual(2);
    const updatedA = putAssets![0] as Junction;
    expect(updatedA.id).toEqual("A");
    expect(updatedA.elevation).toEqual(20);

    const updatedB = putAssets![1] as Reservoir;
    expect(updatedB.id).toEqual("B");
    expect(updatedB.elevation).toEqual(20);
  });

  it("ignores assets that do not have the property provided", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("A")
      .aJunction("B")
      .aPipe("PIPE", { diameter: 10 })
      .build();
    const { putAssets } = changeProperty(hydraulicModel, {
      assetIds: ["A", "B", "PIPE"],
      property: "diameter",
      value: 20,
    });

    expect(putAssets!.length).toEqual(1);
    const updatedPipe = putAssets![0] as Pipe;
    expect(updatedPipe.id).toEqual("PIPE");
    expect(updatedPipe.diameter).toEqual(20);
  });
});

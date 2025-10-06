import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { runCheck } from "./run-check";

describe("runCheck", () => {
  it("identifies orphan assets in hydraulic model", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1")
      .aJunction("J2")
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aJunction("Orphan")
      .build();

    const orphanAssets = await runCheck(model);

    expect(orphanAssets).toEqual([
      expect.objectContaining({ assetId: "Orphan", type: "junction" }),
    ]);
  });
});

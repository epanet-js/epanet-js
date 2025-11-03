import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { runCheck } from "./run-check";

const IDS = {
  J1: 1,
  J2: 2,
  P1: 3,
  Orphan: 4,
} as const;

describe("runCheck", () => {
  it("identifies orphan assets in hydraulic model", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aJunction(IDS.Orphan)
      .build();

    const orphanAssets = await runCheck(model);

    expect(orphanAssets).toEqual([
      expect.objectContaining({
        assetId: IDS.Orphan,
        type: "junction",
      }),
    ]);
  });
});

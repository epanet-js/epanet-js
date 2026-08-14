import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { runCheck } from "./run-check";

const IDS = {
  J1: 1,
  J2: 2,
  P1: 3,
  Orphan: 4,
} as const;

describe("runCheck", () => {
  it("identifies orphan assets in hydraulic model (sync run)", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aJunction(IDS.Orphan)
      .build();

    const orphanAssets = await runCheck(model, undefined, "array", false);

    expect(orphanAssets).toEqual([IDS.Orphan]);
  });

  it("identifies orphan assets in hydraulic model (worker run)", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aJunction(IDS.Orphan)
      .build();

    const orphanAssets = await runCheck(model, undefined, "array", true);

    expect(orphanAssets).toEqual([IDS.Orphan]);
  });

  describe("inactive assets", () => {
    const bothPaths: [string, boolean][] = [
      ["sync run", false],
      ["worker run", true],
    ];

    describe.each(bothPaths)("%s", (_name, runInWorker) => {
      it("does not report a disabled orphan node", async () => {
        const IDS = { Orphan: 1, DisabledOrphan: 2 } as const;
        const model = HydraulicModelBuilder.with()
          .aJunction(IDS.Orphan)
          .aJunction(IDS.DisabledOrphan, { isActive: false })
          .build();

        const orphanAssets = await runCheck(
          model,
          undefined,
          "array",
          runInWorker,
        );

        expect(orphanAssets).toEqual([IDS.Orphan]);
      });

      // The disabled pump is the only link on both of its nodes, so it would be
      // reported as an orphan link if inactive assets were traced.
      it("does not report a disabled pump", async () => {
        const IDS = { J1: 1, J2: 2, P1: 3, T1: 4, J3: 5, DisabledPump: 6 };
        const model = HydraulicModelBuilder.with()
          .aJunction(IDS.J1)
          .aJunction(IDS.J2)
          .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
          .aTank(IDS.T1, { isActive: false })
          .aJunction(IDS.J3, { isActive: false })
          .aPump(IDS.DisabledPump, {
            startNodeId: IDS.T1,
            endNodeId: IDS.J3,
            isActive: false,
          })
          .build();

        const orphanAssets = await runCheck(
          model,
          undefined,
          "array",
          runInWorker,
        );

        expect(orphanAssets).toEqual([]);
      });

      // The neighbouring pipes keep both ends connected in the full topology,
      // so this is only detected when inactive links are excluded before
      // traversal rather than filtered out of the results.
      it("reports a pump whose neighbouring pipes are all disabled", async () => {
        const IDS = {
          J1: 1,
          T1: 2,
          J2: 3,
          J3: 4,
          PU1: 5,
          P1: 6,
          P2: 7,
        } as const;
        const model = HydraulicModelBuilder.with()
          .aJunction(IDS.J1, { isActive: false })
          .aTank(IDS.T1)
          .aJunction(IDS.J2)
          .aJunction(IDS.J3, { isActive: false })
          .aPump(IDS.PU1, { startNodeId: IDS.T1, endNodeId: IDS.J2 })
          .aPipe(IDS.P1, {
            startNodeId: IDS.T1,
            endNodeId: IDS.J1,
            isActive: false,
          })
          .aPipe(IDS.P2, {
            startNodeId: IDS.J2,
            endNodeId: IDS.J3,
            isActive: false,
          })
          .build();

        const orphanAssets = await runCheck(
          model,
          undefined,
          "array",
          runInWorker,
        );

        expect(orphanAssets).toEqual([IDS.PU1]);
      });
    });
  });
});

import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { runCheck } from "./run-check";

const IDS = {
  R1: 1,
  J1: 2,
  J2: 3,
  J3: 4,
  Disabled: 5,
  PU1: 6,
  P1: 7,
  P2: 8,
  P3: 9,
} as const;

const bothPaths: [string, boolean][] = [
  ["sync run", false],
  ["worker run", true],
];

describe.each(bothPaths)("runCheck (%s)", (_name, runInWorker) => {
  const aPumpedNetwork = () =>
    HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aJunction(IDS.Disabled, { isActive: false })
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .aPump(IDS.PU1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 });

  it("flags a pump that feeds itself", async () => {
    const model = aPumpedNetwork()
      .aPipe(IDS.P3, { startNodeId: IDS.J3, endNodeId: IDS.J1 })
      .build();

    expect(await runCheck(model, undefined, "array", runInWorker)).toEqual({
      selfFeedingPumps: [IDS.PU1],
      selfFeedingValves: [],
      junctionsWithoutSupply: [],
    });
  });

  it("ignores a return path through an inactive pipe", async () => {
    const model = aPumpedNetwork()
      .aPipe(IDS.P3, {
        startNodeId: IDS.J3,
        endNodeId: IDS.J1,
        isActive: false,
      })
      .build();

    expect(
      (await runCheck(model, undefined, "array", runInWorker)).selfFeedingPumps,
    ).toEqual([]);
  });

  it("flags only the unsupplied junctions that carry demand", async () => {
    const model = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aJunction(IDS.Disabled, { isActive: false })
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .aPump(IDS.PU1, { startNodeId: IDS.J2, endNodeId: IDS.J1 })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .aJunctionDemand(IDS.J1, [{ baseDemand: 1 }])
      .aJunctionDemand(IDS.J3, [{ baseDemand: 1 }])
      .build();

    expect(
      (await runCheck(model, undefined, "array", runInWorker))
        .junctionsWithoutSupply,
    ).toEqual([{ junctionIds: [IDS.J3], blockingLinkIds: [IDS.PU1] }]);
  });
});

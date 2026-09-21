import { Valve } from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import * as workerInfra from "src/infra/worker";
import { findTargetNodeOptions } from "./find-target-node-options";

const labelsOf = async (model: HydraulicModel, valveId: number) => {
  const valve = model.assets.get(valveId) as unknown as Valve;
  const options = await findTargetNodeOptions(model, valve);
  return options.map((option) => option.label).sort();
};

describe("findTargetNodeOptions", () => {
  beforeEach(() => {
    vi.spyOn(workerInfra, "canUseWorker").mockReturnValue(false);
  });

  it("offers the nodes downstream of the valve, excluding its end node", async () => {
    const IDS = { IN: 1, OUT: 2, A: 3, B: 4, V1: 5, P1: 6, P2: 7 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.IN, { label: "IN" })
      .aJunction(IDS.OUT, { label: "OUT" })
      .aJunction(IDS.A, { label: "A" })
      .aJunction(IDS.B, { label: "B" })
      .aValve(IDS.V1, {
        kind: "prv",
        startNodeId: IDS.IN,
        endNodeId: IDS.OUT,
      })
      .aPipe(IDS.P1, { startNodeId: IDS.OUT, endNodeId: IDS.A })
      .aPipe(IDS.P2, { startNodeId: IDS.A, endNodeId: IDS.B })
      .build();

    expect(await labelsOf(model, IDS.V1)).toEqual(["A", "B"]);
  });

  it("does not reach back upstream through the valve itself", async () => {
    const IDS = {
      SOURCE: 1,
      IN: 2,
      OUT: 3,
      A: 4,
      V1: 5,
      P1: 6,
      P2: 7,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.SOURCE, { label: "SOURCE" })
      .aJunction(IDS.IN, { label: "IN" })
      .aJunction(IDS.OUT, { label: "OUT" })
      .aJunction(IDS.A, { label: "A" })
      .aPipe(IDS.P1, { startNodeId: IDS.SOURCE, endNodeId: IDS.IN })
      .aValve(IDS.V1, {
        kind: "prv",
        startNodeId: IDS.IN,
        endNodeId: IDS.OUT,
      })
      .aPipe(IDS.P2, { startNodeId: IDS.OUT, endNodeId: IDS.A })
      .build();

    expect(await labelsOf(model, IDS.V1)).toEqual(["A"]);
  });

  it("stops at a downstream valve", async () => {
    const IDS = { IN: 1, OUT: 2, A: 3, FAR: 4, V1: 5, V2: 6, P1: 7 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.IN, { label: "IN" })
      .aJunction(IDS.OUT, { label: "OUT" })
      .aJunction(IDS.A, { label: "A" })
      .aJunction(IDS.FAR, { label: "FAR" })
      .aValve(IDS.V1, {
        kind: "prv",
        startNodeId: IDS.IN,
        endNodeId: IDS.OUT,
      })
      .aPipe(IDS.P1, { startNodeId: IDS.OUT, endNodeId: IDS.A })
      .aValve(IDS.V2, { kind: "prv", startNodeId: IDS.A, endNodeId: IDS.FAR })
      .build();

    expect(await labelsOf(model, IDS.V1)).toEqual(["A"]);
  });

  it("stops at a downstream pump", async () => {
    const IDS = { IN: 1, OUT: 2, A: 3, FAR: 4, V1: 5, PU1: 6, P1: 7 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.IN, { label: "IN" })
      .aJunction(IDS.OUT, { label: "OUT" })
      .aJunction(IDS.A, { label: "A" })
      .aJunction(IDS.FAR, { label: "FAR" })
      .aValve(IDS.V1, {
        kind: "prv",
        startNodeId: IDS.IN,
        endNodeId: IDS.OUT,
      })
      .aPipe(IDS.P1, { startNodeId: IDS.OUT, endNodeId: IDS.A })
      .aPump(IDS.PU1, { startNodeId: IDS.A, endNodeId: IDS.FAR })
      .build();

    expect(await labelsOf(model, IDS.V1)).toEqual(["A"]);
  });

  it("does not offer a downstream tank", async () => {
    const IDS = { IN: 1, OUT: 2, A: 3, T1: 4, V1: 5, P1: 6, P2: 7 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.IN, { label: "IN" })
      .aJunction(IDS.OUT, { label: "OUT" })
      .aJunction(IDS.A, { label: "A" })
      .aTank(IDS.T1, { label: "TANK" })
      .aValve(IDS.V1, {
        kind: "prv",
        startNodeId: IDS.IN,
        endNodeId: IDS.OUT,
      })
      .aPipe(IDS.P1, { startNodeId: IDS.OUT, endNodeId: IDS.A })
      .aPipe(IDS.P2, { startNodeId: IDS.A, endNodeId: IDS.T1 })
      .build();

    expect(await labelsOf(model, IDS.V1)).toEqual(["A"]);
  });

  it("does not offer nodes behind a closed pipe", async () => {
    const IDS = { IN: 1, OUT: 2, A: 3, B: 4, V1: 5, P1: 6, P2: 7 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.IN, { label: "IN" })
      .aJunction(IDS.OUT, { label: "OUT" })
      .aJunction(IDS.A, { label: "A" })
      .aJunction(IDS.B, { label: "B" })
      .aValve(IDS.V1, {
        kind: "prv",
        startNodeId: IDS.IN,
        endNodeId: IDS.OUT,
      })
      .aPipe(IDS.P1, { startNodeId: IDS.OUT, endNodeId: IDS.A })
      .aPipe(IDS.P2, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        initialStatus: "closed",
      })
      .build();

    expect(await labelsOf(model, IDS.V1)).toEqual(["A"]);
  });
});

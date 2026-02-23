import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { ResultsReader } from "src/simulation/results-reader";
import { upstreamTrace } from "./upstream-trace";
import { FlowDirection } from "./flow-direction";

function mockResultsReader(flows: Record<number, number>): ResultsReader {
  return {
    getPipe: (id) =>
      id in flows
        ? {
            type: "pipe",
            flow: flows[id],
            velocity: 0,
            headloss: 0,
            unitHeadloss: 0,
            status: "open",
          }
        : null,
    getValve: (id) =>
      id in flows
        ? {
            type: "valve",
            flow: flows[id],
            velocity: 0,
            headloss: 0,
            status: "active",
            statusWarning: null,
          }
        : null,
    getPump: (id) =>
      id in flows
        ? {
            type: "pump",
            flow: flows[id],
            headloss: 0,
            status: "on",
            statusWarning: null,
          }
        : null,
    getJunction: () => null,
    getTank: () => null,
    getAllPressures: () => [],
    getAllHeads: () => [],
    getAllDemands: () => [],
    getAllFlows: () => [],
    getAllVelocities: () => [],
    getAllUnitHeadlosses: () => [],
  };
}

describe("upstreamTrace", () => {
  it("uses assumed flow direction when no simulation is available", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const status = new FlowDirection(model.assets, null);
    const result = upstreamTrace(
      { nodeIds: [IDS.J2], linkIds: [] },
      model.topology,
      status,
    );

    // Without simulation, pipes assume DOWNSTREAM (start→end),
    // so upstream from J2 follows P1 back to J1
    expect(result.nodeIds).toEqual(expect.arrayContaining([IDS.J2, IDS.J1]));
    expect(result.linkIds).toEqual([IDS.P1]);
  });

  it("follows flow direction upstream (positive flow)", () => {
    //  R1 --P1--> J1 --P2--> J2
    //  Flow: P1=+5, P2=+3
    //  Starting at J2, upstream should find J1 and R1
    const IDS = { R1: 1, J1: 2, J2: 3, P1: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .aPipe(IDS.P2, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const reader = mockResultsReader({ [IDS.P1]: 5, [IDS.P2]: 3 });
    const status = new FlowDirection(model.assets, reader);
    const result = upstreamTrace(
      { nodeIds: [IDS.J2], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.nodeIds).toEqual(
      expect.arrayContaining([IDS.J2, IDS.J1, IDS.R1]),
    );
    expect(result.linkIds).toEqual(expect.arrayContaining([IDS.P2, IDS.P1]));
  });

  it("follows negative flow upstream", () => {
    //  J1 --P1-- J2  (flow is negative: water flows J2 → J1)
    //  Starting at J1, upstream should find J2
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const reader = mockResultsReader({ [IDS.P1]: -5 });
    const status = new FlowDirection(model.assets, reader);
    const result = upstreamTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.nodeIds).toContain(IDS.J2);
    expect(result.linkIds).toContain(IDS.P1);
  });

  it("does not follow links with zero flow", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .build();

    const reader = mockResultsReader({ [IDS.P1]: 5, [IDS.P2]: 0 });
    const status = new FlowDirection(model.assets, reader);
    const result = upstreamTrace(
      { nodeIds: [IDS.J3], linkIds: [] },
      model.topology,
      status,
    );

    // J3 is the start, but P2 has zero flow so upstream trace can't go further
    expect(result.nodeIds).toContain(IDS.J3);
    expect(result.nodeIds).not.toContain(IDS.J1);
    expect(result.linkIds).not.toContain(IDS.P2);
  });

  it("handles branching network upstream", () => {
    //  J1 --P1--> J3 <--P2-- J2
    //  Both P1 and P2 flow into J3
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J3 })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .build();

    const reader = mockResultsReader({ [IDS.P1]: 3, [IDS.P2]: 2 });
    const status = new FlowDirection(model.assets, reader);
    const result = upstreamTrace(
      { nodeIds: [IDS.J3], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.nodeIds).toEqual(
      expect.arrayContaining([IDS.J3, IDS.J1, IDS.J2]),
    );
    expect(result.linkIds).toEqual(expect.arrayContaining([IDS.P1, IDS.P2]));
  });

  it("traces upstream from a link click", () => {
    //  R1 --P1--> J1 --P2--> J2 --P3--> J3
    //  Flow: P1=+5, P2=+3, P3=+2
    //  Starting from link P2, upstream should trace from J1 (where water enters P2)
    const IDS = {
      R1: 1,
      J1: 2,
      J2: 3,
      J3: 4,
      P1: 5,
      P2: 6,
      P3: 7,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .aPipe(IDS.P2, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P3, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .build();

    const reader = mockResultsReader({
      [IDS.P1]: 5,
      [IDS.P2]: 3,
      [IDS.P3]: 2,
    });
    const status = new FlowDirection(model.assets, reader);
    const result = upstreamTrace(
      { nodeIds: [], linkIds: [IDS.P2] },
      model.topology,
      status,
    );

    expect(result.linkIds).toContain(IDS.P2);
    expect(result.linkIds).toContain(IDS.P1);
    expect(result.nodeIds).toContain(IDS.J1);
    expect(result.nodeIds).toContain(IDS.R1);
    // Should not include downstream side
    expect(result.nodeIds).not.toContain(IDS.J2);
    expect(result.linkIds).not.toContain(IDS.P3);
  });
});

import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { ResultsReader } from "src/simulation/results-reader";
import { boundaryTrace } from "./boundary-trace";
import { upstreamTrace } from "./upstream-trace";
import { downstreamTrace } from "./downstream-trace";
import { TraceStatus } from "./trace-status";

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

describe("boundaryTrace", () => {
  it("traces through open pipes and junctions", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .build();

    const status = new TraceStatus(model.assets, null);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.nodeIds).toEqual(
      expect.arrayContaining([IDS.J1, IDS.J2, IDS.J3]),
    );
    expect(result.linkIds).toEqual(expect.arrayContaining([IDS.P1, IDS.P2]));
  });

  it("stops at boundary nodes (tanks and reservoirs)", () => {
    const IDS = { J1: 1, T1: 2, J2: 3, P1: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aTank(IDS.T1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.T1 })
      .aPipe(IDS.P2, { startNodeId: IDS.T1, endNodeId: IDS.J2 })
      .build();

    const status = new TraceStatus(model.assets, null);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.nodeIds).toContain(IDS.J1);
    expect(result.nodeIds).not.toContain(IDS.T1);
    expect(result.nodeIds).not.toContain(IDS.J2);
    expect(result.linkIds).not.toContain(IDS.P2);
  });

  it("stops at boundary links (pumps)", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, PU1: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPump(IDS.PU1, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .build();

    const status = new TraceStatus(model.assets, null);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.nodeIds).toEqual(expect.arrayContaining([IDS.J1, IDS.J2]));
    expect(result.linkIds).toContain(IDS.P1);
    expect(result.linkIds).not.toContain(IDS.PU1);
    expect(result.nodeIds).not.toContain(IDS.J3);
  });

  it("stops at closed pipes", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J3,
        initialStatus: "closed",
      })
      .build();

    const status = new TraceStatus(model.assets, null);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.nodeIds).toEqual(expect.arrayContaining([IDS.J1, IDS.J2]));
    expect(result.linkIds).toContain(IDS.P1);
    expect(result.linkIds).not.toContain(IDS.P2);
    expect(result.nodeIds).not.toContain(IDS.J3);
  });

  it("traverses CV pipes only in the forward direction", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, CV: 4, P1: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.CV, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        initialStatus: "cv",
      })
      .aPipe(IDS.P1, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .build();

    const status = new TraceStatus(model.assets, null);

    // Forward direction: J1 → J2 through CV pipe works
    const forward = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      status,
    );
    expect(forward.linkIds).toContain(IDS.CV);
    expect(forward.nodeIds).toContain(IDS.J2);

    // Reverse direction: J2 → J1 through CV pipe is blocked
    const reverse = boundaryTrace(
      { nodeIds: [IDS.J2], linkIds: [] },
      model.topology,
      status,
    );
    expect(reverse.linkIds).not.toContain(IDS.CV);
    expect(reverse.nodeIds).not.toContain(IDS.J1);
  });

  it("includes pre-selected links when starting from a link click", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .build();

    const status = new TraceStatus(model.assets, null);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1, IDS.J2], linkIds: [IDS.P1] },
      model.topology,
      status,
    );

    expect(result.linkIds).toContain(IDS.P1);
    expect(result.linkIds).toContain(IDS.P2);
  });

  it("stops at non-TCV valves", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, PRV: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aValve(IDS.PRV, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J3,
        kind: "prv",
      })
      .build();

    const status = new TraceStatus(model.assets, null);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.linkIds).not.toContain(IDS.PRV);
    expect(result.nodeIds).not.toContain(IDS.J3);
  });

  it("traverses open TCV valves", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, TCV: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aValve(IDS.TCV, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J3,
        kind: "tcv",
        initialStatus: "active",
      })
      .build();

    const status = new TraceStatus(model.assets, null);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.linkIds).toContain(IDS.TCV);
    expect(result.nodeIds).toContain(IDS.J3);
  });

  it("stops at closed TCV valves", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, TCV: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aValve(IDS.TCV, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J3,
        kind: "tcv",
        initialStatus: "closed",
      })
      .build();

    const status = new TraceStatus(model.assets, null);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.linkIds).not.toContain(IDS.TCV);
    expect(result.nodeIds).not.toContain(IDS.J3);
  });

  it("uses simulation status over initialStatus for pipes", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J3,
        initialStatus: "closed",
      })
      .build();

    // Simulation says P2 is open, overriding initialStatus "closed"
    const reader = mockResultsReader({});
    reader.getPipe = (id) => {
      if (id === IDS.P2)
        return {
          type: "pipe",
          flow: 0,
          velocity: 0,
          headloss: 0,
          unitHeadloss: 0,
          status: "open",
        };
      return {
        type: "pipe",
        flow: 0,
        velocity: 0,
        headloss: 0,
        unitHeadloss: 0,
        status: "open",
      };
    };

    const status = new TraceStatus(model.assets, reader);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.linkIds).toContain(IDS.P2);
    expect(result.nodeIds).toContain(IDS.J3);
  });

  it("treats pipe as boundary when simulation says closed", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .build();

    // Simulation says P2 is closed, even though initialStatus is "open"
    const reader = mockResultsReader({});
    reader.getPipe = (id) => {
      if (id === IDS.P2)
        return {
          type: "pipe",
          flow: 0,
          velocity: 0,
          headloss: 0,
          unitHeadloss: 0,
          status: "closed",
        };
      return {
        type: "pipe",
        flow: 0,
        velocity: 0,
        headloss: 0,
        unitHeadloss: 0,
        status: "open",
      };
    };

    const status = new TraceStatus(model.assets, reader);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.linkIds).not.toContain(IDS.P2);
    expect(result.nodeIds).not.toContain(IDS.J3);
  });

  it("uses simulation status over initialStatus for TCV valves", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, TCV: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aValve(IDS.TCV, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J3,
        kind: "tcv",
        initialStatus: "closed",
      })
      .build();

    // Simulation says TCV is active, overriding initialStatus "closed"
    const reader = mockResultsReader({});
    reader.getValve = (id) => {
      if (id === IDS.TCV)
        return {
          type: "valve",
          flow: 0,
          velocity: 0,
          headloss: 0,
          status: "active",
          statusWarning: null,
        };
      return null;
    };

    const status = new TraceStatus(model.assets, reader);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.linkIds).toContain(IDS.TCV);
    expect(result.nodeIds).toContain(IDS.J3);
  });
});

describe("upstreamTrace", () => {
  it("does not traverse links when no flow data is available", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const status = new TraceStatus(model.assets, null);
    const result = upstreamTrace(
      { nodeIds: [IDS.J2], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.nodeIds).toEqual([IDS.J2]);
    expect(result.linkIds).toEqual([]);
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
    const status = new TraceStatus(model.assets, reader);
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
    const status = new TraceStatus(model.assets, reader);
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
    const status = new TraceStatus(model.assets, reader);
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
    const status = new TraceStatus(model.assets, reader);
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
    const status = new TraceStatus(model.assets, reader);
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

describe("downstreamTrace", () => {
  it("does not traverse links when no flow data is available", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const status = new TraceStatus(model.assets, null);
    const result = downstreamTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.nodeIds).toEqual([IDS.J1]);
    expect(result.linkIds).toEqual([]);
  });

  it("follows flow direction downstream (positive flow)", () => {
    //  R1 --P1--> J1 --P2--> J2
    //  Flow: P1=+5, P2=+3
    //  Starting at R1, downstream should find J1 and J2
    const IDS = { R1: 1, J1: 2, J2: 3, P1: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .aPipe(IDS.P2, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const reader = mockResultsReader({ [IDS.P1]: 5, [IDS.P2]: 3 });
    const status = new TraceStatus(model.assets, reader);
    const result = downstreamTrace(
      { nodeIds: [IDS.R1], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.nodeIds).toEqual(
      expect.arrayContaining([IDS.R1, IDS.J1, IDS.J2]),
    );
    expect(result.linkIds).toEqual(expect.arrayContaining([IDS.P1, IDS.P2]));
  });

  it("follows negative flow downstream", () => {
    //  J1 --P1-- J2  (flow is negative: water flows J2 → J1)
    //  Starting at J2, downstream should find J1
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const reader = mockResultsReader({ [IDS.P1]: -5 });
    const status = new TraceStatus(model.assets, reader);
    const result = downstreamTrace(
      { nodeIds: [IDS.J2], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.nodeIds).toContain(IDS.J1);
    expect(result.linkIds).toContain(IDS.P1);
  });

  it("skips links with zero flow", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .build();

    const reader = mockResultsReader({ [IDS.P1]: 5, [IDS.P2]: 0 });
    const status = new TraceStatus(model.assets, reader);
    const result = downstreamTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.nodeIds).toContain(IDS.J1);
    expect(result.nodeIds).toContain(IDS.J2);
    expect(result.nodeIds).not.toContain(IDS.J3);
    expect(result.linkIds).toContain(IDS.P1);
    expect(result.linkIds).not.toContain(IDS.P2);
  });

  it("handles splitting network downstream", () => {
    //  J1 --P1--> J2 --P2--> J3
    //                --P3--> J4
    const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6, P3: 7 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aJunction(IDS.J4)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .aPipe(IDS.P3, { startNodeId: IDS.J2, endNodeId: IDS.J4 })
      .build();

    const reader = mockResultsReader({
      [IDS.P1]: 5,
      [IDS.P2]: 3,
      [IDS.P3]: 2,
    });
    const status = new TraceStatus(model.assets, reader);
    const result = downstreamTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      status,
    );

    expect(result.nodeIds).toEqual(
      expect.arrayContaining([IDS.J1, IDS.J2, IDS.J3, IDS.J4]),
    );
    expect(result.linkIds).toEqual(
      expect.arrayContaining([IDS.P1, IDS.P2, IDS.P3]),
    );
  });

  it("traces downstream from a link click", () => {
    //  R1 --P1--> J1 --P2--> J2 --P3--> J3
    //  Flow: P1=+5, P2=+3, P3=+2
    //  Starting from link P2, downstream should trace from J2 (where water exits P2)
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
    const status = new TraceStatus(model.assets, reader);
    const result = downstreamTrace(
      { nodeIds: [], linkIds: [IDS.P2] },
      model.topology,
      status,
    );

    expect(result.linkIds).toContain(IDS.P2);
    expect(result.linkIds).toContain(IDS.P3);
    expect(result.nodeIds).toContain(IDS.J2);
    expect(result.nodeIds).toContain(IDS.J3);
    // Should not include upstream side
    expect(result.nodeIds).not.toContain(IDS.J1);
    expect(result.linkIds).not.toContain(IDS.P1);
  });
});

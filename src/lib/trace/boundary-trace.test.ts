import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { createMockResultsReader } from "src/__helpers__/state";
import { boundaryTrace } from "./boundary-trace";
import { AllowedFlowDirection } from "./allowed-flow-direction";

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

    const traversal = new AllowedFlowDirection(model.assets, null);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      model.assetIndex,
      traversal,
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

    const traversal = new AllowedFlowDirection(model.assets, null);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      model.assetIndex,
      traversal,
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

    const traversal = new AllowedFlowDirection(model.assets, null);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      model.assetIndex,
      traversal,
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

    const traversal = new AllowedFlowDirection(model.assets, null);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      model.assetIndex,
      traversal,
    );

    expect(result.nodeIds).toEqual(expect.arrayContaining([IDS.J1, IDS.J2]));
    expect(result.linkIds).toContain(IDS.P1);
    expect(result.linkIds).not.toContain(IDS.P2);
    expect(result.nodeIds).not.toContain(IDS.J3);
  });

  it("traverses CV pipes only in forward direction", () => {
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

    const traversal = new AllowedFlowDirection(model.assets, null);

    // Forward direction: J1 → J2 through CV pipe works
    const forward = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      model.assetIndex,
      traversal,
    );
    expect(forward.linkIds).toContain(IDS.CV);
    expect(forward.nodeIds).toContain(IDS.J2);

    // Reverse direction: J2 → J1 through CV pipe is blocked
    const reverse = boundaryTrace(
      { nodeIds: [IDS.J2], linkIds: [] },
      model.topology,
      model.assetIndex,
      traversal,
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

    const traversal = new AllowedFlowDirection(model.assets, null);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1, IDS.J2], linkIds: [IDS.P1] },
      model.topology,
      model.assetIndex,
      traversal,
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

    const traversal = new AllowedFlowDirection(model.assets, null);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      model.assetIndex,
      traversal,
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

    const traversal = new AllowedFlowDirection(model.assets, null);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      model.assetIndex,
      traversal,
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

    const traversal = new AllowedFlowDirection(model.assets, null);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      model.assetIndex,
      traversal,
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

    // Simulation says P2 is open with flow, overriding initialStatus "closed"
    const reader = createMockResultsReader({
      pipes: { [IDS.P1]: { flow: 5 }, [IDS.P2]: { flow: 3 } },
    });

    const traversal = new AllowedFlowDirection(model.assets, reader);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      model.assetIndex,
      traversal,
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
    const reader = createMockResultsReader({});
    reader.getPipe = (id: number) => {
      if (id === IDS.P2)
        return {
          type: "pipe",
          flow: 0,
          velocity: 0,
          headloss: 0,
          unitHeadloss: 0,
          status: "closed",
          waterAge: null,
          waterTrace: null,
          chemicalConcentration: null,
        };
      return {
        type: "pipe",
        flow: 0,
        velocity: 0,
        headloss: 0,
        unitHeadloss: 0,
        status: "open",
        waterAge: null,
        waterTrace: null,
        chemicalConcentration: null,
      };
    };

    const traversal = new AllowedFlowDirection(model.assets, reader);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      model.assetIndex,
      traversal,
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

    // Simulation says TCV is active with flow, overriding initialStatus "closed"
    const reader = createMockResultsReader({
      pipes: { [IDS.P1]: { flow: 5 } },
    });
    reader.getValve = (id: number) => {
      if (id === IDS.TCV)
        return {
          type: "valve",
          flow: 3,
          velocity: 0,
          headloss: 0,
          status: "active",
          statusWarning: null,
          waterAge: null,
          waterTrace: null,
          chemicalConcentration: null,
        };
      return null;
    };

    const traversal = new AllowedFlowDirection(model.assets, reader);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      model.assetIndex,
      traversal,
    );

    expect(result.linkIds).toContain(IDS.TCV);
    expect(result.nodeIds).toContain(IDS.J3);
  });
});

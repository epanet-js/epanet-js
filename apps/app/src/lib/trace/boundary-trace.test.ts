import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { createMockResultsReader } from "src/__helpers__/state";
import {
  boundaryBarriers,
  boundaryTraceDeprecated,
  configuredAllowedFlowDirections,
  presetBarriers,
  configuredValveKinds,
  stopPresets,
  trace,
  unrestrictedFlowDirections,
  weightedTrace,
  type TraceStop,
} from "@epanet-js/hydraulic-model";
import { AllowedFlowDirection } from "./allowed-flow-direction";

const boundaryTraceWithBarriers: typeof boundaryTraceDeprecated = (
  start,
  topology,
  assetIndex,
  status,
) => trace(start, topology, status, boundaryBarriers(assetIndex, status));

describe.each([
  { name: "boundaryTraceDeprecated", boundaryTrace: boundaryTraceDeprecated },
  {
    name: "trace with boundary barriers",
    boundaryTrace: boundaryTraceWithBarriers,
  },
])("$name", ({ boundaryTrace }) => {
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

describe("trace stops", () => {
  it("reports each barrier it stopped at, why, and where it came from", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      J3: 3,
      J4: 4,
      J5: 5,
      T1: 6,
      P1: 7,
      PU1: 8,
      P2: 9,
      CV: 10,
      P3: 11,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aJunction(IDS.J4)
      .aJunction(IDS.J5)
      .aTank(IDS.T1)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPump(IDS.PU1, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J4,
        initialStatus: "closed",
      })
      .aPipe(IDS.CV, {
        startNodeId: IDS.J5,
        endNodeId: IDS.J2,
        initialStatus: "cv",
      })
      .aPipe(IDS.P3, { startNodeId: IDS.J1, endNodeId: IDS.T1 })
      .build();

    const traversal = new AllowedFlowDirection(model.assets, null);
    const result = trace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      traversal,
      boundaryBarriers(model.assetIndex, traversal),
    );

    expect(result.stops).toHaveLength(4);
    expect(result.stops).toEqual(
      expect.arrayContaining([
        {
          assetId: IDS.T1,
          reason: "barrier",
          fromNodeId: IDS.J1,
          viaLinkId: IDS.P3,
        },
        {
          assetId: IDS.PU1,
          reason: "barrier",
          fromNodeId: IDS.J2,
          viaLinkId: null,
        },
        {
          assetId: IDS.P2,
          reason: "closed",
          fromNodeId: IDS.J2,
          viaLinkId: null,
        },
        {
          assetId: IDS.CV,
          reason: "direction",
          fromNodeId: IDS.J2,
          viaLinkId: null,
        },
      ]),
    );
  });

  it("does not report a one-way link it later crossed from its start", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, CV: 4, P1: 5, P2: 6 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P2, { startNodeId: IDS.J1, endNodeId: IDS.J3 })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.CV, {
        startNodeId: IDS.J3,
        endNodeId: IDS.J2,
        initialStatus: "cv",
      })
      .build();

    const traversal = new AllowedFlowDirection(model.assets, null);
    const result = trace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      traversal,
      boundaryBarriers(model.assetIndex, traversal),
    );

    expect(result.linkIds).toContain(IDS.CV);
    expect(result.stops).toEqual([]);
  });
});

describe("weightedTrace without limits", () => {
  const random = (seed: number) => () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pick = <T>(next: () => number, items: readonly T[]): T =>
    items[Math.floor(next() * items.length)];

  const aRandomModel = (next: () => number) => {
    const nodeCount = 3 + Math.floor(next() * 20);
    const builder = HydraulicModelBuilder.with();
    for (let id = 1; id <= nodeCount; id++) {
      const kind = next();
      if (kind < 0.08) builder.aTank(id);
      else if (kind < 0.14) builder.aReservoir(id);
      else builder.aJunction(id);
    }
    const linkCount = Math.floor(nodeCount * (1 + next()));
    for (let i = 0; i < linkCount; i++) {
      const id = 100 + i;
      const startNodeId = 1 + Math.floor(next() * nodeCount);
      const endNodeId =
        ((startNodeId + Math.floor(next() * (nodeCount - 1))) % nodeCount) + 1;
      const kind = next();
      if (kind < 0.7) {
        builder.aPipe(id, {
          startNodeId,
          endNodeId,
          length: 1 + Math.floor(next() * 100),
          initialStatus: pick(next, ["open", "open", "closed", "cv"] as const),
        });
      } else if (kind < 0.82) {
        builder.aPump(id, {
          startNodeId,
          endNodeId,
          initialStatus: pick(next, ["on", "off"] as const),
        });
      } else {
        builder.aValve(id, {
          startNodeId,
          endNodeId,
          kind: pick(next, [
            "prv",
            "psv",
            "fcv",
            "pbv",
            "tcv",
            "gpv",
            "pcv",
          ] as const),
          initialStatus: pick(next, ["active", "open", "closed"] as const),
        });
      }
    }
    return builder.build();
  };

  const stopsOf = (stops: TraceStop<string>[]) =>
    stops.map(({ assetId, reason }) => `${assetId}:${reason}`).sort();

  it("reaches the same nodes and links, and stops at the same assets for the same reasons, as trace", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const next = random(seed);
      const model = aRandomModel(next);
      const directions = configuredAllowedFlowDirections(model.assets);
      const presets = stopPresets.filter(() => next() < 0.3);
      const barriers = presetBarriers(
        presets,
        model.assetIndex,
        directions,
        configuredValveKinds(model.assets),
      );
      const nodeIds = [...model.assets.values()]
        .filter((asset) => !asset.isLink)
        .map((asset) => asset.id);
      const linkIds = [...model.assets.values()]
        .filter((asset) => asset.isLink)
        .map((asset) => asset.id);
      const start = {
        nodeIds: [pick(next, nodeIds)],
        linkIds: next() < 0.5 ? [pick(next, linkIds)] : [],
      };

      const walk = seed % 2 === 0 ? unrestrictedFlowDirections : directions;

      const traced = trace(start, model.topology, walk, barriers);
      const weighted = weightedTrace(start, model.topology, walk, barriers, {
        maxDistance: Infinity,
        maxHops: Infinity,
        lengthOf: () => 1,
      });

      expect({
        seed,
        nodes: [...weighted.nodeIds].sort(),
        links: [...weighted.linkIds].sort(),
        stops: stopsOf(weighted.stops),
      }).toEqual({
        seed,
        nodes: [...traced.nodeIds].sort(),
        links: [...traced.linkIds].sort(),
        stops: stopsOf(traced.stops),
      });
    }
  });
});

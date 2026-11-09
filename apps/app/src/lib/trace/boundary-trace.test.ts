import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { createMockResultsReader } from "src/__helpers__/state";
import {
  AllowedFlowDirection as AFD,
  boundaryBarriers,
  configuredAllowedFlowDirections,
  presetBarriers,
  respectingFlowDirection,
  configuredValveKinds,
  stopPresets,
  trace,
  unrestrictedFlowDirections,
  weightedTrace,
  type AllowedFlowDirectionQueries,
  type TraceStop,
} from "@epanet-js/hydraulic-model";
import { encodeTraceData } from "./encode-trace-buffers";
import { runTrace } from "./run-trace";
import { workerAPI } from "./worker-api";

const boundaryTrace = (
  start: Parameters<typeof trace>[0],
  topology: Parameters<typeof trace>[1],
  assetIndex: Parameters<typeof boundaryBarriers>[1],
  status: Parameters<typeof boundaryBarriers>[2],
) => trace(start, topology, boundaryBarriers(topology, assetIndex, status));

describe("trace with boundary barriers", () => {
  it("traces through open pipes and junctions", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .build();

    const traversal = configuredAllowedFlowDirections(model.assets);
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

    const traversal = configuredAllowedFlowDirections(model.assets);
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

    const traversal = configuredAllowedFlowDirections(model.assets);
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

    const traversal = configuredAllowedFlowDirections(model.assets);
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

    const traversal = configuredAllowedFlowDirections(model.assets);

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

    const traversal = configuredAllowedFlowDirections(model.assets);
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

    const traversal = configuredAllowedFlowDirections(model.assets);
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

    const traversal = configuredAllowedFlowDirections(model.assets);
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

    const traversal = configuredAllowedFlowDirections(model.assets);
    const result = boundaryTrace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      model.assetIndex,
      traversal,
    );

    expect(result.linkIds).not.toContain(IDS.TCV);
    expect(result.nodeIds).not.toContain(IDS.J3);
  });
});

describe("boundary trace across inactive assets", () => {
  const IDS = {
    J1: 1,
    J2: 2,
    J3: 3,
    J4: 4,
    P1: 5,
    P2: 6,
    P3: 7,
  } as const;
  const model = HydraulicModelBuilder.with()
    .aJunction(IDS.J1)
    .aJunction(IDS.J2)
    .aJunction(IDS.J3, { isActive: false })
    .aJunction(IDS.J4, { isActive: false })
    .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
    .aPipe(IDS.P2, {
      startNodeId: IDS.J2,
      endNodeId: IDS.J3,
      isActive: false,
    })
    .aPipe(IDS.P3, {
      startNodeId: IDS.J3,
      endNodeId: IDS.J4,
      isActive: false,
    })
    .build();

  const fromActive = [IDS.J1, IDS.J2, IDS.P1];
  const fromInactive = [IDS.J3, IDS.J4, IDS.P2, IDS.P3];
  const sorted = (ids: number[]) => [...ids].sort((a, b) => a - b);

  const boundaryRun = (input: {
    startNodeIds?: number[];
    startLinkIds?: number[];
  }) =>
    runTrace(model, null, {
      mode: "boundary",
      startNodeIds: input.startNodeIds ?? [],
      startLinkIds: input.startLinkIds ?? [],
    });

  it("stops at inactive links when started from an active asset", async () => {
    const assetIds = await boundaryRun({ startNodeIds: [IDS.J1] });

    expect(sorted(assetIds)).toEqual(sorted(fromActive));
  });

  it("stays within inactive links when started from an inactive link", async () => {
    const assetIds = await boundaryRun({ startLinkIds: [IDS.P3] });

    expect(sorted(assetIds)).toEqual(sorted(fromInactive));
  });

  it("follows the same rule through the worker buffers", () => {
    const data = encodeTraceData(model, null, "boundary");
    const traced = (linkIds: number[], startsOnActiveAsset: boolean) => {
      const result = workerAPI.runTrace(
        "boundary",
        { nodeIds: [], linkIds },
        data,
        startsOnActiveAsset,
      );
      return sorted([...result.nodeIds, ...result.linkIds]);
    };

    expect(traced([IDS.P1], true)).toEqual(sorted(fromActive));
    expect(traced([IDS.P3], false)).toEqual(sorted(fromInactive));
  });
});

describe("upstream trace through the worker buffers", () => {
  it("follows simulated flow to where the water comes from", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();
    const reader = createMockResultsReader({
      pipes: { [IDS.P1]: { flow: 5 } },
    });

    const result = workerAPI.runTrace(
      "upstream",
      { nodeIds: [IDS.J2], linkIds: [] },
      encodeTraceData(model, reader, "upstream"),
      true,
    );

    expect(result.nodeIds).toEqual(expect.arrayContaining([IDS.J1, IDS.J2]));
    expect(result.linkIds).toEqual([IDS.P1]);
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

    const traversal = configuredAllowedFlowDirections(model.assets);
    const result = trace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      boundaryBarriers(model.topology, model.assetIndex, traversal),
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

    const traversal = configuredAllowedFlowDirections(model.assets);
    const result = trace(
      { nodeIds: [IDS.J1], linkIds: [] },
      model.topology,
      boundaryBarriers(model.topology, model.assetIndex, traversal),
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

  it("stops a link for closed, then barrier, then direction, from either side", () => {
    const anyDirection: AllowedFlowDirectionQueries = {
      getAllowedFlowDirection: (linkId) =>
        [AFD.NONE, AFD.BOTH, AFD.DOWNSTREAM, AFD.UPSTREAM][linkId % 4],
    };

    for (let seed = 1; seed <= 200; seed++) {
      const next = random(seed);
      const model = aRandomModel(next);
      const walks = [
        configuredAllowedFlowDirections(model.assets),
        unrestrictedFlowDirections,
        anyDirection,
      ];

      for (const walk of walks) {
        const presets = stopPresets.filter(() => next() < 0.3);
        const presetsOnly = presetBarriers(
          presets,
          model.assetIndex,
          walk,
          configuredValveKinds(model.assets),
        );
        const barriers = respectingFlowDirection(
          presetsOnly,
          model.topology,
          walk,
        );

        const expectedReason = (linkId: number, fromNodeId: number) => {
          const direction = walk.getAllowedFlowDirection(linkId);
          const [startNode, endNode] = model.topology.getNodes(linkId);
          if (direction === AFD.NONE) return "closed";
          if (presetsOnly.linkStopReason(linkId, fromNodeId) !== null)
            return "barrier";
          if (direction === AFD.DOWNSTREAM && fromNodeId !== startNode)
            return "direction";
          if (direction === AFD.UPSTREAM && fromNodeId !== endNode)
            return "direction";
          return null;
        };

        for (const [linkId] of model.assetIndex.iterateLinks()) {
          for (const fromNodeId of model.topology.getNodes(linkId)) {
            expect(barriers.linkStopReason(linkId, fromNodeId)).toBe(
              expectedReason(linkId, fromNodeId),
            );
          }
        }
      }
    }
  });

  it("gives the same boundary trace through the worker buffers as on the model", () => {
    const sorted = (ids: number[]) => [...ids].sort((a, b) => a - b);

    for (let seed = 1; seed <= 200; seed++) {
      const model = aRandomModel(random(seed));
      const directions = configuredAllowedFlowDirections(model.assets);
      const data = encodeTraceData(model, null, "boundary");

      for (const [nodeId] of model.assetIndex.iterateNodes()) {
        const start = { nodeIds: [nodeId], linkIds: [] };
        const onModel = trace(
          start,
          model.topology,
          boundaryBarriers(model.topology, model.assetIndex, directions),
        );
        const onBuffers = workerAPI.runTrace("boundary", start, data, true);

        expect(sorted(onBuffers.nodeIds)).toEqual(sorted(onModel.nodeIds));
        expect(sorted(onBuffers.linkIds)).toEqual(sorted(onModel.linkIds));
      }
    }
  });

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

      const traced = trace(
        start,
        model.topology,
        respectingFlowDirection(barriers, model.topology, walk),
      );
      const weighted = weightedTrace(
        start,
        model.topology,
        respectingFlowDirection(barriers, model.topology, walk),
        {
          maxDistance: Infinity,
          maxHops: Infinity,
          lengthOf: () => 1,
        },
      );

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

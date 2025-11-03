import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { findProximityAnomalies } from "./find-proximity-anomalies";
import {
  EncodedHydraulicModel,
  HydraulicModelEncoder,
} from "../hydraulic-model-buffers";
import { HydraulicModel } from "src/hydraulic-model";

describe("findProximityAnomalies", () => {
  function encodeData(model: HydraulicModel): EncodedHydraulicModel {
    const encoder = new HydraulicModelEncoder(model, {
      nodes: new Set(["bounds", "connections"]),
      links: new Set(["connections", "geoIndex"]),
      bufferType: "array",
    });
    return encoder.buildBuffers();
  }

  it("does not report unconnected nodes", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, J3: 4 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [0, 0.001] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aJunction(IDS.J3, { coordinates: [0.0001, 0.0005] })
      .build();
    const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

    const proximityAnomalies = findProximityAnomalies(data, 50);

    expect(proximityAnomalies).toHaveLength(0);
  });

  it("reports nodes connected elsewhere as alternative connections", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, J3: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [0, 0.001] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aJunction(IDS.J3, { coordinates: [0.0001, 0.0005] })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .build();
    const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

    const proximityAnomalies = findProximityAnomalies(data, 50);

    expect(proximityAnomalies).toHaveLength(1);
    expect(nodeIdsLookup[proximityAnomalies[0].nodeId]).toEqual(IDS.J3);
    expect(linkIdsLookup[proximityAnomalies[0].connection.pipeId]).toEqual(
      IDS.P1,
    );
  });

  it("does not report nodes directly connected to the pipe", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [0, 0.001] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();
    const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

    const proximityAnomalies = findProximityAnomalies(data, 50);

    expect(proximityAnomalies).toHaveLength(0);
  });

  it("does not report nodes that are too far from any pipe", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, J3: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [0, 0.001] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aJunction(IDS.J3, { coordinates: [1, 1] })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .build();
    const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

    const proximityAnomalies = findProximityAnomalies(data, 0.5);

    expect(proximityAnomalies).toHaveLength(0);
  });

  it("finds multiple connected nodes near the same pipe", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, J3: 4, J4: 5, P2: 6 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [0, 0.002] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aJunction(IDS.J3, { coordinates: [0.0001, 0.0005] })
      .aJunction(IDS.J4, { coordinates: [0.0001, 0.0015] })
      .aPipe(IDS.P2, { startNodeId: IDS.J3, endNodeId: IDS.J4 })
      .build();
    const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

    const proximityAnomalies = findProximityAnomalies(data, 50);

    expect(proximityAnomalies).toHaveLength(2);
    const nodeIds = proximityAnomalies.map((pc) => nodeIdsLookup[pc.nodeId]);
    expect(nodeIds).toContain(IDS.J3);
    expect(nodeIds).toContain(IDS.J4);
  });

  it("chooses the nearest pipe when multiple pipes are candidates", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      P1: 3,
      J3: 4,
      J4: 5,
      P2: 6,
      J5: 7,
      P3: 8,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [0, 0.001] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aJunction(IDS.J3, { coordinates: [0.001, 0] })
      .aJunction(IDS.J4, { coordinates: [0.001, 0.001] })
      .aPipe(IDS.P2, { startNodeId: IDS.J3, endNodeId: IDS.J4 })
      .aJunction(IDS.J5, { coordinates: [0.0001, 0.0005] })
      .aPipe(IDS.P3, { startNodeId: IDS.J2, endNodeId: IDS.J5 })
      .build();
    const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

    const proximityAnomalies = findProximityAnomalies(data, 50);

    expect(proximityAnomalies).toHaveLength(1);
    expect(nodeIdsLookup[proximityAnomalies[0].nodeId]).toEqual(IDS.J5);
    expect(linkIdsLookup[proximityAnomalies[0].connection.pipeId]).toEqual(
      IDS.P1,
    );
  });

  it("does not suggest connections too close to already connected junctions", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, J3: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [0, 0.001] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aJunction(IDS.J3, { coordinates: [0.00001, 0.00001] })
      .aPipe(IDS.P2, { startNodeId: IDS.J1, endNodeId: IDS.J3 })
      .build();
    const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

    const proximityAnomalies = findProximityAnomalies(data, 50, 5);

    expect(proximityAnomalies).toHaveLength(0);
  });

  it("handles nodes connected to valves and pumps", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      P1: 3,
      T1: 4,
      J3: 5,
      V1: 6,
      J4: 7,
      P2: 8,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [0, 0.001] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aTank(IDS.T1, { coordinates: [0.005, 0.0005] })
      .aJunction(IDS.J3, { coordinates: [0.005, 0] })
      .aValve(IDS.V1, {
        startNodeId: IDS.T1,
        endNodeId: IDS.J3,
      })
      .aJunction(IDS.J4, { coordinates: [0.0001, 0.0005] })
      .aPipe(IDS.P2, { startNodeId: IDS.J3, endNodeId: IDS.J4 })
      .build();
    const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

    const proximityAnomalies = findProximityAnomalies(data, 50);

    expect(proximityAnomalies).toHaveLength(1);
    expect(nodeIdsLookup[proximityAnomalies[0].nodeId]).toEqual(IDS.J4);
    expect(linkIdsLookup[proximityAnomalies[0].connection.pipeId]).toEqual(
      IDS.P1,
    );
  });
});

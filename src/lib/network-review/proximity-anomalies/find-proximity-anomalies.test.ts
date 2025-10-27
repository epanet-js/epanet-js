import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { findProximityAnomalies } from "./find-proximity-anomalies";
import { HydraulicModelEncoder } from "../shared";
import { RunData } from "./data";
import { HydraulicModel } from "src/hydraulic-model";

describe("findProximityAnomalies", () => {
  function encodeData(model: HydraulicModel) {
    const encoder = new HydraulicModelEncoder(model, {
      nodes: new Set(["bounds", "connections"]),
      links: new Set(["connections", "geoIndex"]),
      bufferType: "array",
    });
    return encoder.buildBuffers();
  }

  it("does not report unconnected nodes", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [0, 0.001] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aJunction("J3", { coordinates: [0.0001, 0.0005] })
      .build();
    const encoded = encodeData(model);
    const data: RunData = {
      nodePositions: encoded.nodes.positions,
      nodeConnections: encoded.nodes.connections,
      linksConnections: encoded.links.connections,
      pipeSegmentIds: encoded.pipeSegments.ids,
      pipeSegmentCoordinates: encoded.pipeSegments.coordinates,
      pipeSegmentsGeoIndex: encoded.pipeSegments.geoIndex,
    };

    const proximityAnomalies = findProximityAnomalies(data, 50);

    expect(proximityAnomalies).toHaveLength(0);
  });

  it("reports nodes connected elsewhere as alternative connections", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [0, 0.001] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aJunction("J3", { coordinates: [0.0001, 0.0005] })
      .aPipe("P2", { startNodeId: "J2", endNodeId: "J3" })
      .build();
    const encoded = encodeData(model);
    const data: RunData = {
      nodePositions: encoded.nodes.positions,
      nodeConnections: encoded.nodes.connections,
      linksConnections: encoded.links.connections,
      pipeSegmentIds: encoded.pipeSegments.ids,
      pipeSegmentCoordinates: encoded.pipeSegments.coordinates,
      pipeSegmentsGeoIndex: encoded.pipeSegments.geoIndex,
    };

    const proximityAnomalies = findProximityAnomalies(data, 50);

    expect(proximityAnomalies).toHaveLength(1);
    expect(encoded.nodeIdsLookup[proximityAnomalies[0].nodeId]).toEqual("J3");
    expect(
      encoded.linkIdsLookup[proximityAnomalies[0].connection.pipeId],
    ).toEqual("P1");
  });

  it("does not report nodes directly connected to the pipe", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [0, 0.001] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();
    const encoded = encodeData(model);
    const data: RunData = {
      nodePositions: encoded.nodes.positions,
      nodeConnections: encoded.nodes.connections,
      linksConnections: encoded.links.connections,
      pipeSegmentIds: encoded.pipeSegments.ids,
      pipeSegmentCoordinates: encoded.pipeSegments.coordinates,
      pipeSegmentsGeoIndex: encoded.pipeSegments.geoIndex,
    };

    const proximityAnomalies = findProximityAnomalies(data, 50);

    expect(proximityAnomalies).toHaveLength(0);
  });

  it("does not report nodes that are too far from any pipe", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [0, 0.001] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aJunction("J3", { coordinates: [1, 1] })
      .aPipe("P2", { startNodeId: "J2", endNodeId: "J3" })
      .build();
    const encoded = encodeData(model);
    const data: RunData = {
      nodePositions: encoded.nodes.positions,
      nodeConnections: encoded.nodes.connections,
      linksConnections: encoded.links.connections,
      pipeSegmentIds: encoded.pipeSegments.ids,
      pipeSegmentCoordinates: encoded.pipeSegments.coordinates,
      pipeSegmentsGeoIndex: encoded.pipeSegments.geoIndex,
    };

    const proximityAnomalies = findProximityAnomalies(data, 0.5);

    expect(proximityAnomalies).toHaveLength(0);
  });

  it("finds multiple connected nodes near the same pipe", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [0, 0.002] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aJunction("J3", { coordinates: [0.0001, 0.0005] })
      .aJunction("J4", { coordinates: [0.0001, 0.0015] })
      .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
      .build();
    const encoded = encodeData(model);
    const data: RunData = {
      nodePositions: encoded.nodes.positions,
      nodeConnections: encoded.nodes.connections,
      linksConnections: encoded.links.connections,
      pipeSegmentIds: encoded.pipeSegments.ids,
      pipeSegmentCoordinates: encoded.pipeSegments.coordinates,
      pipeSegmentsGeoIndex: encoded.pipeSegments.geoIndex,
    };

    const proximityAnomalies = findProximityAnomalies(data, 50);

    expect(proximityAnomalies).toHaveLength(2);
    const nodeIds = proximityAnomalies.map(
      (pc) => encoded.nodeIdsLookup[pc.nodeId],
    );
    expect(nodeIds).toContain("J3");
    expect(nodeIds).toContain("J4");
  });

  it("chooses the nearest pipe when multiple pipes are candidates", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [0, 0.001] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aJunction("J3", { coordinates: [0.001, 0] })
      .aJunction("J4", { coordinates: [0.001, 0.001] })
      .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
      .aJunction("J5", { coordinates: [0.0001, 0.0005] })
      .aPipe("P3", { startNodeId: "J2", endNodeId: "J5" })
      .build();
    const encoded = encodeData(model);
    const data: RunData = {
      nodePositions: encoded.nodes.positions,
      nodeConnections: encoded.nodes.connections,
      linksConnections: encoded.links.connections,
      pipeSegmentIds: encoded.pipeSegments.ids,
      pipeSegmentCoordinates: encoded.pipeSegments.coordinates,
      pipeSegmentsGeoIndex: encoded.pipeSegments.geoIndex,
    };

    const proximityAnomalies = findProximityAnomalies(data, 50);

    expect(proximityAnomalies).toHaveLength(1);
    expect(encoded.nodeIdsLookup[proximityAnomalies[0].nodeId]).toEqual("J5");
    expect(
      encoded.linkIdsLookup[proximityAnomalies[0].connection.pipeId],
    ).toEqual("P1");
  });

  it("does not suggest connections too close to already connected junctions", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [0, 0.001] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aJunction("J3", { coordinates: [0.00001, 0.00001] })
      .aPipe("P2", { startNodeId: "J1", endNodeId: "J3" })
      .build();
    const encoded = encodeData(model);
    const data: RunData = {
      nodePositions: encoded.nodes.positions,
      nodeConnections: encoded.nodes.connections,
      linksConnections: encoded.links.connections,
      pipeSegmentIds: encoded.pipeSegments.ids,
      pipeSegmentCoordinates: encoded.pipeSegments.coordinates,
      pipeSegmentsGeoIndex: encoded.pipeSegments.geoIndex,
    };

    const proximityAnomalies = findProximityAnomalies(data, 50, 5);

    expect(proximityAnomalies).toHaveLength(0);
  });

  it("handles nodes connected to valves and pumps", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [0, 0.001] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aTank("T1", { coordinates: [0.005, 0.0005] })
      .aJunction("J3", { coordinates: [0.005, 0] })
      .aValve("V1", { startNodeId: "T1", endNodeId: "J3" })
      .aJunction("J4", { coordinates: [0.0001, 0.0005] })
      .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
      .build();
    const encoded = encodeData(model);
    const data: RunData = {
      nodePositions: encoded.nodes.positions,
      nodeConnections: encoded.nodes.connections,
      linksConnections: encoded.links.connections,
      pipeSegmentIds: encoded.pipeSegments.ids,
      pipeSegmentCoordinates: encoded.pipeSegments.coordinates,
      pipeSegmentsGeoIndex: encoded.pipeSegments.geoIndex,
    };

    const proximityAnomalies = findProximityAnomalies(data, 50);

    expect(proximityAnomalies).toHaveLength(1);
    expect(encoded.nodeIdsLookup[proximityAnomalies[0].nodeId]).toEqual("J4");
    expect(
      encoded.linkIdsLookup[proximityAnomalies[0].connection.pipeId],
    ).toEqual("P1");
  });
});

import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { decodeProximityAnomalies } from "./data";

describe("decodeProximityAnomalies", () => {
  it("sorts proximity anomalies by distance (ascending)", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { label: "Junction1" })
      .aJunction("J2", { label: "Junction2" })
      .aJunction("J3", { label: "Junction3" })
      .aJunction("J4")
      .aJunction("J5")
      .aJunction("J6")
      .aPipe("P1", { startNodeId: "J4", endNodeId: "J5" })
      .aPipe("P2", { startNodeId: "J5", endNodeId: "J6" })
      .build();

    const nodeIdsLookup = ["J1", "J2", "J3"];
    const linkIdsLookup = ["P1", "P2"];
    const encodedProximityAnomalies = [
      {
        nodeId: 0,
        connection: { pipeId: 0, distance: 10.5, nearestPointOnPipe: [0, 0] },
      },
      {
        nodeId: 1,
        connection: { pipeId: 1, distance: 2.3, nearestPointOnPipe: [1, 1] },
      },
      {
        nodeId: 2,
        connection: { pipeId: 0, distance: 5.7, nearestPointOnPipe: [2, 2] },
      },
    ];

    const anomalies = decodeProximityAnomalies(
      model,
      nodeIdsLookup,
      linkIdsLookup,
      encodedProximityAnomalies,
    );

    expect(anomalies).toHaveLength(3);
    expect(anomalies[0].distance).toBe(2.3);
    expect(anomalies[1].distance).toBe(5.7);
    expect(anomalies[2].distance).toBe(10.5);
  });

  it("sorts anomalies with same distance by node label (alphabetical)", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { label: "Charlie" })
      .aJunction("J2", { label: "Alice" })
      .aJunction("J3", { label: "Bob" })
      .aJunction("J4")
      .aJunction("J5")
      .aPipe("P1", { startNodeId: "J4", endNodeId: "J5" })
      .build();

    const nodeIdsLookup = ["J1", "J2", "J3"];
    const linkIdsLookup = ["P1"];
    const encodedProximityAnomalies = [
      {
        nodeId: 0,
        connection: { pipeId: 0, distance: 5.0, nearestPointOnPipe: [0, 0] },
      },
      {
        nodeId: 1,
        connection: { pipeId: 0, distance: 5.0, nearestPointOnPipe: [1, 1] },
      },
      {
        nodeId: 2,
        connection: { pipeId: 0, distance: 5.0, nearestPointOnPipe: [2, 2] },
      },
    ];

    const anomalies = decodeProximityAnomalies(
      model,
      nodeIdsLookup,
      linkIdsLookup,
      encodedProximityAnomalies,
    );

    expect(anomalies).toHaveLength(3);
    expect(anomalies[0].nodeId).toBe("J2"); // Alice
    expect(anomalies[1].nodeId).toBe("J3"); // Bob
    expect(anomalies[2].nodeId).toBe("J1"); // Charlie
  });

  it("filters out anomalies where pipe asset doesn't exist", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { label: "Junction1" })
      .aJunction("J2")
      .aJunction("J3")
      .aPipe("P1", { startNodeId: "J2", endNodeId: "J3" })
      .build();

    const nodeIdsLookup = ["J1"];
    const linkIdsLookup = ["P1", "P2NonExistent"];
    const encodedProximityAnomalies = [
      {
        nodeId: 0,
        connection: { pipeId: 0, distance: 5.0, nearestPointOnPipe: [0, 0] },
      },
      {
        nodeId: 0,
        connection: { pipeId: 1, distance: 3.0, nearestPointOnPipe: [1, 1] },
      },
    ];

    const anomalies = decodeProximityAnomalies(
      model,
      nodeIdsLookup,
      linkIdsLookup,
      encodedProximityAnomalies,
    );

    // Should only include the one with valid pipe
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].pipeId).toBe("P1");
  });

  it("filters out anomalies where link is not a pipe", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { label: "Junction1" })
      .aJunction("J2")
      .aJunction("J3")
      .aJunction("J4")
      .aJunction("J5")
      .aPipe("P1", { startNodeId: "J2", endNodeId: "J3" })
      .aValve("V1", { startNodeId: "J4", endNodeId: "J5" })
      .build();

    const nodeIdsLookup = ["J1"];
    const linkIdsLookup = ["P1", "V1"];
    const encodedProximityAnomalies = [
      {
        nodeId: 0,
        connection: { pipeId: 0, distance: 5.0, nearestPointOnPipe: [0, 0] },
      },
      {
        nodeId: 0,
        connection: { pipeId: 1, distance: 3.0, nearestPointOnPipe: [1, 1] },
      },
    ];

    const anomalies = decodeProximityAnomalies(
      model,
      nodeIdsLookup,
      linkIdsLookup,
      encodedProximityAnomalies,
    );

    // Should only include the pipe, not the valve
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].pipeId).toBe("P1");
    expect(anomalies[0].distance).toBe(5.0);
  });

  it("preserves distance and nearestPointOnPipe coordinates", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { label: "Junction1" })
      .aJunction("J2")
      .aJunction("J3")
      .aPipe("P1", { startNodeId: "J2", endNodeId: "J3" })
      .build();

    const nodeIdsLookup = ["J1"];
    const linkIdsLookup = ["P1"];
    const encodedProximityAnomalies = [
      {
        nodeId: 0,
        connection: {
          pipeId: 0,
          distance: 123.456,
          nearestPointOnPipe: [78.9, 12.34],
        },
      },
    ];

    const anomalies = decodeProximityAnomalies(
      model,
      nodeIdsLookup,
      linkIdsLookup,
      encodedProximityAnomalies,
    );

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].distance).toBe(123.456);
    expect(anomalies[0].nearestPointOnPipe).toEqual([78.9, 12.34]);
  });

  it("handles edge case with missing node asset (uses nodeId as fallback label)", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { label: "ExistingNode" })
      .aJunction("J2")
      .aJunction("J3")
      .aPipe("P1", { startNodeId: "J2", endNodeId: "J3" })
      .build();

    // Provide a nodeId that doesn't exist in the model
    const nodeIdsLookup = ["J1", "NonExistentNode"];
    const linkIdsLookup = ["P1"];
    const encodedProximityAnomalies = [
      {
        nodeId: 0,
        connection: { pipeId: 0, distance: 5.0, nearestPointOnPipe: [0, 0] },
      },
      {
        nodeId: 1,
        connection: { pipeId: 0, distance: 3.0, nearestPointOnPipe: [1, 1] },
      },
    ];

    const anomalies = decodeProximityAnomalies(
      model,
      nodeIdsLookup,
      linkIdsLookup,
      encodedProximityAnomalies,
    );

    expect(anomalies).toHaveLength(2);
    // Should be sorted by distance first
    expect(anomalies[0].distance).toBe(3.0);
    expect(anomalies[0].nodeId).toBe("NonExistentNode");
    expect(anomalies[1].distance).toBe(5.0);
    expect(anomalies[1].nodeId).toBe("J1");
  });
});

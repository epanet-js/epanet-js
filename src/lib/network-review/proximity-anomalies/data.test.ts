import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { decodeProximityAnomalies } from "./data";

describe("decodeProximityAnomalies", () => {
  it("sorts proximity anomalies by distance (ascending)", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      J3: 3,
      J4: 4,
      J5: 5,
      J6: 6,
      P1: 7,
      P2: 8,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { label: "Junction1" })
      .aJunction(IDS.J2, { label: "Junction2" })
      .aJunction(IDS.J3, { label: "Junction3" })
      .aJunction(IDS.J4)
      .aJunction(IDS.J5)
      .aJunction(IDS.J6)
      .aPipe(IDS.P1, { startNodeId: String(IDS.J4), endNodeId: String(IDS.J5) })
      .aPipe(IDS.P2, { startNodeId: String(IDS.J5), endNodeId: String(IDS.J6) })
      .build();

    const nodeIdsLookup = [String(IDS.J1), String(IDS.J2), String(IDS.J3)];
    const linkIdsLookup = [String(IDS.P1), String(IDS.P2)];
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
    const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, J5: 5, P1: 6 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { label: "Charlie" })
      .aJunction(IDS.J2, { label: "Alice" })
      .aJunction(IDS.J3, { label: "Bob" })
      .aJunction(IDS.J4)
      .aJunction(IDS.J5)
      .aPipe(IDS.P1, { startNodeId: String(IDS.J4), endNodeId: String(IDS.J5) })
      .build();

    const nodeIdsLookup = [String(IDS.J1), String(IDS.J2), String(IDS.J3)];
    const linkIdsLookup = [String(IDS.P1)];
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
    expect(anomalies[0].nodeId).toBe(String(IDS.J2)); // Alice
    expect(anomalies[1].nodeId).toBe(String(IDS.J3)); // Bob
    expect(anomalies[2].nodeId).toBe(String(IDS.J1)); // Charlie
  });

  it("filters out anomalies where pipe asset doesn't exist", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { label: "Junction1" })
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: String(IDS.J2), endNodeId: String(IDS.J3) })
      .build();

    const nodeIdsLookup = [String(IDS.J1)];
    const linkIdsLookup = [String(IDS.P1), "P2NonExistent"];
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
    expect(anomalies[0].pipeId).toBe(String(IDS.P1));
  });

  it("filters out anomalies where link is not a pipe", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, J5: 5, P1: 6, V1: 7 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { label: "Junction1" })
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aJunction(IDS.J4)
      .aJunction(IDS.J5)
      .aPipe(IDS.P1, { startNodeId: String(IDS.J2), endNodeId: String(IDS.J3) })
      .aValve(IDS.V1, {
        startNodeId: String(IDS.J4),
        endNodeId: String(IDS.J5),
      })
      .build();

    const nodeIdsLookup = [String(IDS.J1)];
    const linkIdsLookup = [String(IDS.P1), String(IDS.V1)];
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
    expect(anomalies[0].pipeId).toBe(String(IDS.P1));
    expect(anomalies[0].distance).toBe(5.0);
  });

  it("preserves distance and nearestPointOnPipe coordinates", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { label: "Junction1" })
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: String(IDS.J2), endNodeId: String(IDS.J3) })
      .build();

    const nodeIdsLookup = [String(IDS.J1)];
    const linkIdsLookup = [String(IDS.P1)];
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
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { label: "ExistingNode" })
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, { startNodeId: String(IDS.J2), endNodeId: String(IDS.J3) })
      .build();

    // Provide a nodeId that doesn't exist in the model
    const nodeIdsLookup = [String(IDS.J1), "NonExistentNode"];
    const linkIdsLookup = [String(IDS.P1)];
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
    expect(anomalies[1].nodeId).toBe(String(IDS.J1));
  });
});

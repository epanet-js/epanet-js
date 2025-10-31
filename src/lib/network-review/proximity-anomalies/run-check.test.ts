import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { runCheck } from "./run-check";

describe("runCheck", () => {
  it("identifies junctions with alternative nearby connections", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3, J3: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [0, 0.001] })
      .aPipe(IDS.P1, { startNodeId: String(IDS.J1), endNodeId: String(IDS.J2) })
      .aJunction(IDS.J3, { coordinates: [0.0001, 0.0005] })
      .aPipe(IDS.P2, { startNodeId: String(IDS.J2), endNodeId: String(IDS.J3) })
      .build();

    const proximityAnomalies = await runCheck(model, 50);

    expect(proximityAnomalies).toHaveLength(1);
    expect(proximityAnomalies[0]).toEqual(
      expect.objectContaining({
        nodeId: String(IDS.J3),
        pipeId: String(IDS.P1),
        distance: expect.any(Number),
        nearestPointOnPipe: expect.any(Array),
      }),
    );
    expect(proximityAnomalies[0].distance).toBeLessThan(50);
  });

  it("returns empty array when no proximity anomalies are found", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3, J3: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [0, 0.001] })
      .aPipe(IDS.P1, { startNodeId: String(IDS.J1), endNodeId: String(IDS.J2) })
      .aJunction(IDS.J3, { coordinates: [1, 1] })
      .aPipe(IDS.P2, { startNodeId: String(IDS.J2), endNodeId: String(IDS.J3) })
      .build();

    const proximityAnomalies = await runCheck(model, 0.5);

    expect(proximityAnomalies).toHaveLength(0);
  });

  it("sorts results by distance, then by node label", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3, J5: 4, J3: 5, P2: 6 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0], label: "J1" })
      .aJunction(IDS.J2, { coordinates: [0, 0.002], label: "J2" })
      .aPipe(IDS.P1, { startNodeId: String(IDS.J1), endNodeId: String(IDS.J2) })
      .aJunction(IDS.J5, { coordinates: [0.0001, 0.0015], label: "J5" })
      .aJunction(IDS.J3, { coordinates: [0.0001, 0.0005], label: "J3" })
      .aPipe(IDS.P2, { startNodeId: String(IDS.J3), endNodeId: String(IDS.J5) })
      .build();

    const proximityAnomalies = await runCheck(model, 50);

    expect(proximityAnomalies).toHaveLength(2);
    expect(proximityAnomalies[0].nodeId).toEqual(String(IDS.J5));
    expect(proximityAnomalies[1].nodeId).toEqual(String(IDS.J3));
    expect(proximityAnomalies[0].distance).toBeLessThan(
      proximityAnomalies[1].distance,
    );
  });

  it("works with array buffer type", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3, J3: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [0, 0.001] })
      .aPipe(IDS.P1, { startNodeId: String(IDS.J1), endNodeId: String(IDS.J2) })
      .aJunction(IDS.J3, { coordinates: [0.0001, 0.0005] })
      .aPipe(IDS.P2, { startNodeId: String(IDS.J2), endNodeId: String(IDS.J3) })
      .build();

    const proximityAnomalies = await runCheck(model, 50, "array");

    expect(proximityAnomalies).toHaveLength(1);
    expect(proximityAnomalies[0].nodeId).toEqual(String(IDS.J3));
  });
});

import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { runCheck } from "./run-check";

describe("runCheck", () => {
  it("identifies junctions that can be connected to nearby pipes", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [0, 0.001] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aJunction("J3", { coordinates: [0.0001, 0.0005] })
      .build();

    const possibleConnections = await runCheck(model, 50);

    expect(possibleConnections).toHaveLength(1);
    expect(possibleConnections[0]).toEqual(
      expect.objectContaining({
        nodeId: "J3",
        pipeId: "P1",
        distance: expect.any(Number),
        nearestPointOnPipe: expect.any(Array),
      }),
    );
    expect(possibleConnections[0].distance).toBeLessThan(50);
  });

  it("returns empty array when no connections are found", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [0, 0.001] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aJunction("J3", { coordinates: [1, 1] })
      .build();

    const possibleConnections = await runCheck(model, 0.5);

    expect(possibleConnections).toHaveLength(0);
  });

  it("sorts results by node label", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0], label: "J1" })
      .aJunction("J2", { coordinates: [0, 0.002], label: "J2" })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aJunction("J5", { coordinates: [0.0001, 0.0015], label: "J5" })
      .aJunction("J3", { coordinates: [0.0001, 0.0005], label: "J3" })
      .build();

    const possibleConnections = await runCheck(model, 50);

    expect(possibleConnections).toHaveLength(2);
    expect(possibleConnections[0].nodeId).toEqual("J3");
    expect(possibleConnections[1].nodeId).toEqual("J5");
  });

  it("works with array buffer type", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [0, 0.001] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aJunction("J3", { coordinates: [0.0001, 0.0005] })
      .build();

    const possibleConnections = await runCheck(model, 50, "array");

    expect(possibleConnections).toHaveLength(1);
    expect(possibleConnections[0].nodeId).toEqual("J3");
  });
});

import { describe, it, expect } from "vitest";
import { addCustomerPoints } from "./add-customer-points";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";
import { Junction } from "src/hydraulic-model/asset-types/junction";
import { CustomerPoint } from "src/hydraulic-model/customer-points";

describe("addCustomerPoints", () => {
  it("connects multiple customer points to their assigned junctions", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cp1 = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });
    cp1.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      junctionId: "J1",
    });

    const cp2 = buildCustomerPoint("CP2", {
      coordinates: [8, 1],
      demand: 50,
    });
    cp2.connect({
      pipeId: "P1",
      snapPoint: [8, 0],
      junctionId: "J2",
    });

    customerPointsToAdd.push(cp1);
    customerPointsToAdd.push(cp2);

    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    expect(updatedModel.customerPoints.size).toBe(2);
    expect(updatedModel.customerPoints.has("CP1")).toBe(true);
    expect(updatedModel.customerPoints.has("CP2")).toBe(true);

    const j1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints("J1");
    const j2CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints("J2");

    expect(j1CustomerPoints).toBeDefined();
    expect(Array.from(j1CustomerPoints!)).toContain(cp1);

    expect(j2CustomerPoints).toBeDefined();
    expect(Array.from(j2CustomerPoints!)).toContain(cp2);
  });

  it("handles empty customer points gracefully", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];
    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    expect(updatedModel.customerPoints.size).toBe(0);
    expect(updatedModel.customerPointsLookup.hasConnections("J1")).toBe(false);
  });

  it("adds disconnected customer points to model but does not assign them to junctions", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cpWithoutConnection = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });
    customerPointsToAdd.push(cpWithoutConnection);

    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    expect(updatedModel.customerPoints.size).toBe(1);
    expect(updatedModel.customerPoints.has("CP1")).toBe(true);

    expect(updatedModel.customerPointsLookup.hasConnections("J1")).toBe(false);
  });

  it("handles mixed connected and disconnected customer points", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const connectedCP = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });
    connectedCP.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      junctionId: "J1",
    });

    const disconnectedCP = buildCustomerPoint("CP2", {
      coordinates: [5, 5],
      demand: 30,
    });

    customerPointsToAdd.push(connectedCP);
    customerPointsToAdd.push(disconnectedCP);

    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    expect(updatedModel.customerPoints.size).toBe(2);
    expect(updatedModel.customerPoints.has("CP1")).toBe(true);
    expect(updatedModel.customerPoints.has("CP2")).toBe(true);

    const j1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints("J1");
    expect(j1CustomerPoints).toBeDefined();
    expect(Array.from(j1CustomerPoints!)).toContain(connectedCP);
    expect(Array.from(j1CustomerPoints!)).not.toContain(disconnectedCP);
  });

  it("skips customer points with invalid junction references", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cpWithInvalidJunction = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });

    cpWithInvalidJunction.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      junctionId: "FAKE_J1",
    });

    customerPointsToAdd.push(cpWithInvalidJunction);

    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    expect(updatedModel.customerPoints.size).toBe(1);
    expect(updatedModel.customerPoints.has("CP1")).toBe(true);

    expect(updatedModel.customerPointsLookup.hasConnections("J1")).toBe(false);
  });

  it("handles multiple customer points assigned to the same junction", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cp1 = buildCustomerPoint("CP1", {
      coordinates: [1, 1],
      demand: 25,
    });
    cp1.connect({
      pipeId: "P1",
      snapPoint: [1, 0],
      junctionId: "J1",
    });

    const cp2 = buildCustomerPoint("CP2", {
      coordinates: [2, 1],
      demand: 30,
    });
    cp2.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      junctionId: "J1",
    });

    customerPointsToAdd.push(cp1);
    customerPointsToAdd.push(cp2);

    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    expect(updatedModel.customerPoints.size).toBe(2);

    const j1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints("J1");
    expect(j1CustomerPoints).toBeDefined();
    expect(Array.from(j1CustomerPoints!)).toContain(cp1);
    expect(Array.from(j1CustomerPoints!)).toContain(cp2);

    const j1CustomerPointsArray = Array.from(j1CustomerPoints!);
    const totalDemand = j1CustomerPointsArray.reduce(
      (sum, cp) => sum + cp.baseDemand,
      0,
    );
    expect(totalDemand).toBe(55);
  });

  it("maintains immutability by returning a new hydraulic model", () => {
    const originalModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cp1 = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });
    cp1.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      junctionId: "J1",
    });
    customerPointsToAdd.push(cp1);

    const updatedModel = addCustomerPoints(originalModel, customerPointsToAdd);

    expect(originalModel.customerPoints.size).toBe(0);
    expect(originalModel.customerPointsLookup.hasConnections("J1")).toBe(false);

    expect(updatedModel.customerPoints.size).toBe(1);
    expect(updatedModel.customerPointsLookup.hasConnections("J1")).toBe(true);

    expect(updatedModel).not.toBe(originalModel);
    expect(updatedModel.customerPoints).not.toBe(originalModel.customerPoints);
  });

  it("adds new customer points while preserving existing connections", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aCustomerPoint("EXISTING", {
        coordinates: [1, 1],
        demand: 10,
        connection: {
          pipeId: "P1",
          junctionId: "J1",
          snapPoint: [1, 0],
        },
      })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];
    const newCP = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });
    newCP.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      junctionId: "J1",
    });
    customerPointsToAdd.push(newCP);

    const existingCP = hydraulicModel.customerPoints.get("EXISTING")!;
    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    const j1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints("J1");
    expect(j1CustomerPoints).toBeDefined();
    expect(Array.from(j1CustomerPoints!)).toContain(newCP);
    expect(Array.from(j1CustomerPoints!)).toContain(existingCP);
  });

  it("preserves junction base demands by default", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0], baseDemand: 30 })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cp1 = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });
    cp1.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      junctionId: "J1",
    });
    customerPointsToAdd.push(cp1);

    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    const updatedJ1 = updatedModel.assets.get("J1") as Junction;
    expect(updatedJ1.baseDemand).toBe(30);

    const j1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints("J1");
    expect(j1CustomerPoints).toBeDefined();
    const totalCustomerDemand = Array.from(j1CustomerPoints!).reduce(
      (sum, cp) => sum + cp.baseDemand,
      0,
    );
    expect(totalCustomerDemand).toBe(25);
  });

  it("resets junction base demands to 0 when preserveJunctionDemands is false", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0], baseDemand: 60 })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cp1 = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 35,
    });
    cp1.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      junctionId: "J1",
    });
    customerPointsToAdd.push(cp1);

    const updatedModel = addCustomerPoints(
      hydraulicModel,
      customerPointsToAdd,
      {
        preserveJunctionDemands: false,
      },
    );

    const updatedJ1 = updatedModel.assets.get("J1") as Junction;
    expect(updatedJ1.baseDemand).toBe(0);

    const j1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints("J1");
    expect(j1CustomerPoints).toBeDefined();
    const totalCustomerDemand = Array.from(j1CustomerPoints!).reduce(
      (sum, cp) => sum + cp.baseDemand,
      0,
    );
    expect(totalCustomerDemand).toBe(35);
  });

  it("connects customer points to their assigned pipes", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cp1 = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });
    cp1.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      junctionId: "J1",
    });

    const cp2 = buildCustomerPoint("CP2", {
      coordinates: [8, 1],
      demand: 50,
    });
    cp2.connect({
      pipeId: "P1",
      snapPoint: [8, 0],
      junctionId: "J2",
    });

    customerPointsToAdd.push(cp1);
    customerPointsToAdd.push(cp2);

    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    expect(updatedModel.customerPoints.size).toBe(2);

    const p1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints("P1");
    expect(p1CustomerPoints).toBeDefined();
    expect(Array.from(p1CustomerPoints!)).toContain(cp1);
    expect(Array.from(p1CustomerPoints!)).toContain(cp2);
  });

  it("populates customer points lookup when adding connected customer points", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const cp1 = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 100,
    });
    cp1.connect({ pipeId: "P1", snapPoint: [2, 0], junctionId: "J1" });

    const cp2 = buildCustomerPoint("CP2", {
      coordinates: [8, 1],
      demand: 150,
    });
    cp2.connect({ pipeId: "P1", snapPoint: [8, 0], junctionId: "J2" });

    const updatedModel = addCustomerPoints(hydraulicModel, [cp1, cp2]);

    const j1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints("J1");
    const j2CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints("J2");
    const p1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints("P1");

    expect(j1CustomerPoints).toBeDefined();
    expect(j2CustomerPoints).toBeDefined();
    expect(p1CustomerPoints).toBeDefined();

    expect(Array.from(j1CustomerPoints!)).toHaveLength(1);
    expect(Array.from(j1CustomerPoints!)[0]?.id).toBe("CP1");

    expect(Array.from(j2CustomerPoints!)).toHaveLength(1);
    expect(Array.from(j2CustomerPoints!)[0]?.id).toBe("CP2");

    expect(Array.from(p1CustomerPoints!)).toHaveLength(2);

    const p1CustomerPointIds = Array.from(p1CustomerPoints!).map((cp) => cp.id);
    expect(p1CustomerPointIds).toContain("CP1");
    expect(p1CustomerPointIds).toContain("CP2");
  });
});

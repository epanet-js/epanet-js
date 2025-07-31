import { describe, it, expect } from "vitest";
import { connectCustomerPoints } from "./connect-customer-points";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";
import { Junction } from "src/hydraulic-model/asset-types/junction";
import {
  CustomerPoints,
  initializeCustomerPoints,
} from "src/hydraulic-model/customer-points";

describe("connectCustomerPoints", () => {
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

    const junction1 = hydraulicModel.assets.get("J1") as Junction;
    const junction2 = hydraulicModel.assets.get("J2") as Junction;

    const customerPoints: CustomerPoints = new Map();

    const cp1 = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });
    cp1.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      distance: 1,
      junction: junction1,
    });

    const cp2 = buildCustomerPoint("CP2", {
      coordinates: [8, 1],
      demand: 50,
    });
    cp2.connect({
      pipeId: "P1",
      snapPoint: [8, 0],
      distance: 1,
      junction: junction2,
    });

    customerPoints.set("CP1", cp1);
    customerPoints.set("CP2", cp2);

    const updatedModel = connectCustomerPoints(hydraulicModel, customerPoints);

    expect(updatedModel.customerPoints.size).toBe(2);
    expect(updatedModel.customerPoints.has("CP1")).toBe(true);
    expect(updatedModel.customerPoints.has("CP2")).toBe(true);

    const updatedJ1 = updatedModel.assets.get("J1") as Junction;
    const updatedJ2 = updatedModel.assets.get("J2") as Junction;

    expect(updatedJ1.customerPointCount).toBe(1);
    expect(updatedJ1.customerPoints).toContain(cp1);

    expect(updatedJ2.customerPointCount).toBe(1);
    expect(updatedJ2.customerPoints).toContain(cp2);
  });

  it("handles empty customer points map gracefully", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    const emptyCustomerPoints = initializeCustomerPoints();
    const updatedModel = connectCustomerPoints(
      hydraulicModel,
      emptyCustomerPoints,
    );

    expect(updatedModel.customerPoints.size).toBe(0);

    const junction = updatedModel.assets.get("J1") as Junction;
    expect(junction.customerPointCount).toBe(0);
  });

  it("skips customer points without connection information", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    const customerPoints: CustomerPoints = new Map();

    const cpWithoutConnection = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });
    customerPoints.set("CP1", cpWithoutConnection);

    const updatedModel = connectCustomerPoints(hydraulicModel, customerPoints);

    expect(updatedModel.customerPoints.size).toBe(0);

    const junction = updatedModel.assets.get("J1") as Junction;
    expect(junction.customerPointCount).toBe(0);
  });

  it("skips customer points with invalid junction references", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    const customerPoints: CustomerPoints = new Map();

    const cpWithInvalidJunction = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });

    const fakeJunction = new Junction(
      "FAKE_J1",
      [5, 5],
      { type: "junction", baseDemand: 0, elevation: 0, label: "FAKE_J1" },
      hydraulicModel.units,
    );

    cpWithInvalidJunction.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      distance: 1,
      junction: fakeJunction,
    });

    customerPoints.set("CP1", cpWithInvalidJunction);

    const updatedModel = connectCustomerPoints(hydraulicModel, customerPoints);

    expect(updatedModel.customerPoints.size).toBe(0);

    const junction = updatedModel.assets.get("J1") as Junction;
    expect(junction.customerPointCount).toBe(0);
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

    const junction1 = hydraulicModel.assets.get("J1") as Junction;
    const customerPoints: CustomerPoints = new Map();

    const cp1 = buildCustomerPoint("CP1", {
      coordinates: [1, 1],
      demand: 25,
    });
    cp1.connect({
      pipeId: "P1",
      snapPoint: [1, 0],
      distance: 1,
      junction: junction1,
    });

    const cp2 = buildCustomerPoint("CP2", {
      coordinates: [2, 1],
      demand: 30,
    });
    cp2.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      distance: 1,
      junction: junction1,
    });

    customerPoints.set("CP1", cp1);
    customerPoints.set("CP2", cp2);

    const updatedModel = connectCustomerPoints(hydraulicModel, customerPoints);

    expect(updatedModel.customerPoints.size).toBe(2);

    const updatedJ1 = updatedModel.assets.get("J1") as Junction;
    expect(updatedJ1.customerPointCount).toBe(2);
    expect(updatedJ1.customerPoints).toContain(cp1);
    expect(updatedJ1.customerPoints).toContain(cp2);
    expect(updatedJ1.totalCustomerDemand).toBe(55); // (25 + 30) l/s simple sum
  });

  it("maintains immutability by returning a new hydraulic model", () => {
    const originalModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    const junction1 = originalModel.assets.get("J1") as Junction;
    const customerPoints: CustomerPoints = new Map();

    const cp1 = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });
    cp1.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      distance: 1,
      junction: junction1,
    });
    customerPoints.set("CP1", cp1);

    const updatedModel = connectCustomerPoints(originalModel, customerPoints);

    expect(originalModel.customerPoints.size).toBe(0);
    expect(
      (originalModel.assets.get("J1") as Junction).customerPointCount,
    ).toBe(0);

    expect(updatedModel.customerPoints.size).toBe(1);
    expect((updatedModel.assets.get("J1") as Junction).customerPointCount).toBe(
      1,
    );

    expect(updatedModel).not.toBe(originalModel);
    expect(updatedModel.customerPoints).not.toBe(originalModel.customerPoints);
  });

  it("clears existing customer points from junctions before adding new ones", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    const junction1 = hydraulicModel.assets.get("J1") as Junction;

    const existingCP = buildCustomerPoint("EXISTING", {
      coordinates: [1, 1],
      demand: 10,
    });
    junction1.assignCustomerPoint(existingCP);

    expect(junction1.customerPointCount).toBe(1);

    const customerPoints: CustomerPoints = new Map();
    const newCP = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });
    newCP.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      distance: 1,
      junction: junction1,
    });
    customerPoints.set("CP1", newCP);

    const updatedModel = connectCustomerPoints(hydraulicModel, customerPoints);

    const updatedJ1 = updatedModel.assets.get("J1") as Junction;
    expect(updatedJ1.customerPointCount).toBe(1);
    expect(updatedJ1.customerPoints).toContain(newCP);
    expect(updatedJ1.customerPoints).not.toContain(existingCP);
  });

  it("preserves junction base demands by default", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0], baseDemand: 30 })
      .build();

    const junction1 = hydraulicModel.assets.get("J1") as Junction;
    const customerPoints: CustomerPoints = new Map();

    const cp1 = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 25,
    });
    cp1.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      distance: 1,
      junction: junction1,
    });
    customerPoints.set("CP1", cp1);

    const updatedModel = connectCustomerPoints(hydraulicModel, customerPoints);

    const updatedJ1 = updatedModel.assets.get("J1") as Junction;
    expect(updatedJ1.baseDemand).toBe(30);
    expect(updatedJ1.customerPointCount).toBe(1);
    expect(updatedJ1.totalCustomerDemand).toBe(25); // 25 l/s
  });

  it("preserves junction base demands when preserveJunctionDemands is true", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0], baseDemand: 45 })
      .build();

    const junction1 = hydraulicModel.assets.get("J1") as Junction;
    const customerPoints: CustomerPoints = new Map();

    const cp1 = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 20,
    });
    cp1.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      distance: 1,
      junction: junction1,
    });
    customerPoints.set("CP1", cp1);

    const updatedModel = connectCustomerPoints(hydraulicModel, customerPoints, {
      preserveJunctionDemands: true,
    });

    const updatedJ1 = updatedModel.assets.get("J1") as Junction;
    expect(updatedJ1.baseDemand).toBe(45);
    expect(updatedJ1.customerPointCount).toBe(1);
    expect(updatedJ1.totalCustomerDemand).toBe(20); // 20 l/s
  });

  it("resets junction base demands to 0 when preserveJunctionDemands is false", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0], baseDemand: 60 })
      .build();

    const junction1 = hydraulicModel.assets.get("J1") as Junction;
    const customerPoints: CustomerPoints = new Map();

    const cp1 = buildCustomerPoint("CP1", {
      coordinates: [2, 1],
      demand: 35,
    });
    cp1.connect({
      pipeId: "P1",
      snapPoint: [2, 0],
      distance: 1,
      junction: junction1,
    });
    customerPoints.set("CP1", cp1);

    const updatedModel = connectCustomerPoints(hydraulicModel, customerPoints, {
      preserveJunctionDemands: false,
    });

    const updatedJ1 = updatedModel.assets.get("J1") as Junction;
    expect(updatedJ1.baseDemand).toBe(0);
    expect(updatedJ1.customerPointCount).toBe(1);
    expect(updatedJ1.totalCustomerDemand).toBe(35); // 35 l/s
  });
});

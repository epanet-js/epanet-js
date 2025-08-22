import { describe, it, expect } from "vitest";
import { addCustomerPoints } from "./add-customer-points";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";
import { Junction } from "src/hydraulic-model/asset-types/junction";
import {
  CustomerPoint,
  getCustomerPoints,
} from "src/hydraulic-model/customer-points";
import { Pipe } from "src/hydraulic-model/asset-types/pipe";

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

    const updatedJ1 = updatedModel.assets.get("J1") as Junction;
    const updatedJ2 = updatedModel.assets.get("J2") as Junction;

    expect(updatedJ1.customerPointCount).toBe(1);
    expect(
      getCustomerPoints(
        updatedModel.customerPoints,
        updatedJ1.customerPointIds,
      ),
    ).toContain(cp1);

    expect(updatedJ2.customerPointCount).toBe(1);
    expect(
      getCustomerPoints(
        updatedModel.customerPoints,
        updatedJ2.customerPointIds,
      ),
    ).toContain(cp2);
  });

  it("handles empty customer points gracefully", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];
    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    expect(updatedModel.customerPoints.size).toBe(0);

    const junction = updatedModel.assets.get("J1") as Junction;
    expect(junction.customerPointCount).toBe(0);
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

    const junction = updatedModel.assets.get("J1") as Junction;
    expect(junction.customerPointCount).toBe(0);

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

    const junction = updatedModel.assets.get("J1") as Junction;
    expect(junction.customerPointCount).toBe(1);
    expect(
      getCustomerPoints(updatedModel.customerPoints, junction.customerPointIds),
    ).toContain(connectedCP);
    expect(
      getCustomerPoints(updatedModel.customerPoints, junction.customerPointIds),
    ).not.toContain(disconnectedCP);
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

    const updatedJ1 = updatedModel.assets.get("J1") as Junction;
    expect(updatedJ1.customerPointCount).toBe(2);
    expect(
      getCustomerPoints(
        updatedModel.customerPoints,
        updatedJ1.customerPointIds,
      ),
    ).toContain(cp1);
    expect(
      getCustomerPoints(
        updatedModel.customerPoints,
        updatedJ1.customerPointIds,
      ),
    ).toContain(cp2);
    expect(updatedJ1.getTotalCustomerDemand(updatedModel.customerPoints)).toBe(
      55,
    );
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

    const updatedJ1 = updatedModel.assets.get("J1") as Junction;
    expect(updatedJ1.customerPointCount).toBe(1);
    expect(
      getCustomerPoints(
        updatedModel.customerPoints,
        updatedJ1.customerPointIds,
      ),
    ).toContain(newCP);
    expect(
      getCustomerPoints(
        updatedModel.customerPoints,
        updatedJ1.customerPointIds,
      ),
    ).not.toContain(existingCP);
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
    expect(updatedJ1.customerPointCount).toBe(1);
    expect(updatedJ1.getTotalCustomerDemand(updatedModel.customerPoints)).toBe(
      25,
    );
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
    expect(updatedJ1.customerPointCount).toBe(1);
    expect(updatedJ1.getTotalCustomerDemand(updatedModel.customerPoints)).toBe(
      35,
    );
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

    const updatedPipe = updatedModel.assets.get("P1") as Pipe;
    expect(updatedPipe.customerPointCount).toBe(2);
    expect(
      getCustomerPoints(
        updatedModel.customerPoints,
        updatedPipe.customerPointIds,
      ),
    ).toContain(cp1);
    expect(
      getCustomerPoints(
        updatedModel.customerPoints,
        updatedPipe.customerPointIds,
      ),
    ).toContain(cp2);
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

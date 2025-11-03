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
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4, CP2: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cp1 = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
      demand: 25,
    });
    cp1.connect({
      pipeId: IDS.P1,
      snapPoint: [2, 0],
      junctionId: IDS.J1,
    });

    const cp2 = buildCustomerPoint(IDS.CP2, {
      coordinates: [8, 1],
      demand: 50,
    });
    cp2.connect({
      pipeId: IDS.P1,
      snapPoint: [8, 0],
      junctionId: IDS.J2,
    });

    customerPointsToAdd.push(cp1);
    customerPointsToAdd.push(cp2);

    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    expect(updatedModel.customerPoints.size).toBe(2);
    expect(updatedModel.customerPoints.has(IDS.CP1)).toBe(true);
    expect(updatedModel.customerPoints.has(IDS.CP2)).toBe(true);

    const j1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints(IDS.J1);
    const j2CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints(IDS.J2);

    expect(Array.from(j1CustomerPoints)).toContain(cp1);

    expect(Array.from(j2CustomerPoints)).toContain(cp2);
  });

  it("handles empty customer points gracefully", () => {
    const IDS = { J1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];
    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    expect(updatedModel.customerPoints.size).toBe(0);
    expect(updatedModel.customerPointsLookup.hasConnections(IDS.J1)).toBe(
      false,
    );
  });

  it("adds disconnected customer points to model but does not assign them to junctions", () => {
    const IDS = { J1: 1, CP1: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cpWithoutConnection = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
      demand: 25,
    });
    customerPointsToAdd.push(cpWithoutConnection);

    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    expect(updatedModel.customerPoints.size).toBe(1);
    expect(updatedModel.customerPoints.has(IDS.CP1)).toBe(true);

    expect(updatedModel.customerPointsLookup.hasConnections(IDS.J1)).toBe(
      false,
    );
  });

  it("handles mixed connected and disconnected customer points", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4, CP2: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const connectedCP = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
      demand: 25,
    });
    connectedCP.connect({
      pipeId: IDS.P1,
      snapPoint: [2, 0],
      junctionId: IDS.J1,
    });

    const disconnectedCP = buildCustomerPoint(IDS.CP2, {
      coordinates: [5, 5],
      demand: 30,
    });

    customerPointsToAdd.push(connectedCP);
    customerPointsToAdd.push(disconnectedCP);

    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    expect(updatedModel.customerPoints.size).toBe(2);
    expect(updatedModel.customerPoints.has(IDS.CP1)).toBe(true);
    expect(updatedModel.customerPoints.has(IDS.CP2)).toBe(true);

    const j1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints(IDS.J1);
    expect(Array.from(j1CustomerPoints)).toContain(connectedCP);
    expect(Array.from(j1CustomerPoints)).not.toContain(disconnectedCP);
  });

  it("skips customer points with invalid junction references", () => {
    const IDS = { J1: 1, CP1: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cpWithInvalidJunction = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
      demand: 25,
    });

    cpWithInvalidJunction.connect({
      pipeId: 999,
      snapPoint: [2, 0],
      junctionId: 998,
    });

    customerPointsToAdd.push(cpWithInvalidJunction);

    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    expect(updatedModel.customerPoints.size).toBe(1);
    expect(updatedModel.customerPoints.has(IDS.CP1)).toBe(true);

    expect(updatedModel.customerPointsLookup.hasConnections(IDS.J1)).toBe(
      false,
    );
  });

  it("handles multiple customer points assigned to the same junction", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4, CP2: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cp1 = buildCustomerPoint(IDS.CP1, {
      coordinates: [1, 1],
      demand: 25,
    });
    cp1.connect({
      pipeId: IDS.P1,
      snapPoint: [1, 0],
      junctionId: IDS.J1,
    });

    const cp2 = buildCustomerPoint(IDS.CP2, {
      coordinates: [2, 1],
      demand: 30,
    });
    cp2.connect({
      pipeId: IDS.P1,
      snapPoint: [2, 0],
      junctionId: IDS.J1,
    });

    customerPointsToAdd.push(cp1);
    customerPointsToAdd.push(cp2);

    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    expect(updatedModel.customerPoints.size).toBe(2);

    const j1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints(IDS.J1);
    expect(Array.from(j1CustomerPoints)).toContain(cp1);
    expect(Array.from(j1CustomerPoints)).toContain(cp2);

    const j1CustomerPointsArray = Array.from(j1CustomerPoints);
    const totalDemand = j1CustomerPointsArray.reduce(
      (sum, cp) => sum + cp.baseDemand,
      0,
    );
    expect(totalDemand).toBe(55);
  });

  it("maintains immutability by returning a new hydraulic model", () => {
    const IDS = { J1: 1, CP1: 2 } as const;
    const originalModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cp1 = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
      demand: 25,
    });
    cp1.connect({
      pipeId: 999,
      snapPoint: [2, 0],
      junctionId: IDS.J1,
    });
    customerPointsToAdd.push(cp1);

    const updatedModel = addCustomerPoints(originalModel, customerPointsToAdd);

    expect(originalModel.customerPoints.size).toBe(0);
    expect(originalModel.customerPointsLookup.hasConnections(IDS.J1)).toBe(
      false,
    );

    expect(updatedModel.customerPoints.size).toBe(1);
    expect(updatedModel.customerPointsLookup.hasConnections(IDS.J1)).toBe(true);

    expect(updatedModel).not.toBe(originalModel);
    expect(updatedModel.customerPoints).not.toBe(originalModel.customerPoints);
  });

  it("adds new customer points while preserving existing connections", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, EXISTING: 4, CP1: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aCustomerPoint(IDS.EXISTING, {
        coordinates: [1, 1],
        demand: 10,
        connection: {
          pipeId: IDS.P1,
          junctionId: IDS.J1,
          snapPoint: [1, 0],
        },
      })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];
    const newCP = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
      demand: 25,
    });
    newCP.connect({
      pipeId: IDS.P1,
      snapPoint: [2, 0],
      junctionId: IDS.J1,
    });
    customerPointsToAdd.push(newCP);

    const existingCP = hydraulicModel.customerPoints.get(IDS.EXISTING)!;
    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    const j1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints(IDS.J1);
    expect(Array.from(j1CustomerPoints)).toContain(newCP);
    expect(Array.from(j1CustomerPoints)).toContain(existingCP);
  });

  it("preserves junction base demands by default", () => {
    const IDS = { J1: 1, CP1: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0], baseDemand: 30 })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cp1 = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
      demand: 25,
    });
    cp1.connect({
      pipeId: 999,
      snapPoint: [2, 0],
      junctionId: IDS.J1,
    });
    customerPointsToAdd.push(cp1);

    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    const updatedJ1 = updatedModel.assets.get(IDS.J1) as Junction;
    expect(updatedJ1.baseDemand).toBe(30);

    const j1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints(IDS.J1);
    const totalCustomerDemand = Array.from(j1CustomerPoints).reduce(
      (sum, cp) => sum + cp.baseDemand,
      0,
    );
    expect(totalCustomerDemand).toBe(25);
  });

  it("resets junction base demands to 0 when preserveJunctionDemands is false", () => {
    const IDS = { J1: 1, CP1: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0], baseDemand: 60 })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cp1 = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
      demand: 35,
    });
    cp1.connect({
      pipeId: 999,
      snapPoint: [2, 0],
      junctionId: IDS.J1,
    });
    customerPointsToAdd.push(cp1);

    const updatedModel = addCustomerPoints(
      hydraulicModel,
      customerPointsToAdd,
      {
        preserveJunctionDemands: false,
      },
    );

    const updatedJ1 = updatedModel.assets.get(IDS.J1) as Junction;
    expect(updatedJ1.baseDemand).toBe(0);

    const j1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints(IDS.J1);
    const totalCustomerDemand = Array.from(j1CustomerPoints).reduce(
      (sum, cp) => sum + cp.baseDemand,
      0,
    );
    expect(totalCustomerDemand).toBe(35);
  });

  it("connects customer points to their assigned pipes", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4, CP2: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cp1 = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
      demand: 25,
    });
    cp1.connect({
      pipeId: IDS.P1,
      snapPoint: [2, 0],
      junctionId: IDS.J1,
    });

    const cp2 = buildCustomerPoint(IDS.CP2, {
      coordinates: [8, 1],
      demand: 50,
    });
    cp2.connect({
      pipeId: IDS.P1,
      snapPoint: [8, 0],
      junctionId: IDS.J2,
    });

    customerPointsToAdd.push(cp1);
    customerPointsToAdd.push(cp2);

    const updatedModel = addCustomerPoints(hydraulicModel, customerPointsToAdd);

    expect(updatedModel.customerPoints.size).toBe(2);

    const p1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints(IDS.P1);
    expect(Array.from(p1CustomerPoints)).toContain(cp1);
    expect(Array.from(p1CustomerPoints)).toContain(cp2);
  });

  it("populates customer points lookup when adding connected customer points", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4, CP2: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const cp1 = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
      demand: 100,
    });
    cp1.connect({
      pipeId: IDS.P1,
      snapPoint: [2, 0],
      junctionId: IDS.J1,
    });

    const cp2 = buildCustomerPoint(IDS.CP2, {
      coordinates: [8, 1],
      demand: 150,
    });
    cp2.connect({
      pipeId: IDS.P1,
      snapPoint: [8, 0],
      junctionId: IDS.J2,
    });

    const updatedModel = addCustomerPoints(hydraulicModel, [cp1, cp2]);

    const j1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints(IDS.J1);
    const j2CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints(IDS.J2);
    const p1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints(IDS.P1);

    expect(Array.from(j1CustomerPoints)).toHaveLength(1);
    expect(Array.from(j1CustomerPoints)[0]?.id).toBe(IDS.CP1);

    expect(Array.from(j2CustomerPoints)).toHaveLength(1);
    expect(Array.from(j2CustomerPoints)[0]?.id).toBe(IDS.CP2);

    expect(Array.from(p1CustomerPoints)).toHaveLength(2);

    const p1CustomerPointIds = Array.from(p1CustomerPoints).map((cp) => cp.id);
    expect(p1CustomerPointIds).toContain(IDS.CP1);
    expect(p1CustomerPointIds).toContain(IDS.CP2);
  });

  it("overrides existing customer points when overrideExisting is true", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      P1: 3,
      EXISTING1: 4,
      EXISTING2: 5,
      NEW1: 6,
    } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aCustomerPoint(IDS.EXISTING1, {
        coordinates: [1, 1],
        demand: 10,
        connection: {
          pipeId: IDS.P1,
          junctionId: IDS.J1,
          snapPoint: [1, 0],
        },
      })
      .aCustomerPoint(IDS.EXISTING2, {
        coordinates: [9, 1],
        demand: 20,
        connection: {
          pipeId: IDS.P1,
          junctionId: IDS.J2,
          snapPoint: [9, 0],
        },
      })
      .build();

    expect(hydraulicModel.customerPoints.size).toBe(2);

    const newCP = buildCustomerPoint(IDS.NEW1, {
      coordinates: [5, 1],
      demand: 100,
    });
    newCP.connect({
      pipeId: IDS.P1,
      snapPoint: [5, 0],
      junctionId: IDS.J1,
    });

    const updatedModel = addCustomerPoints(hydraulicModel, [newCP], {
      overrideExisting: true,
    });

    expect(updatedModel.customerPoints.size).toBe(1);
    expect(updatedModel.customerPoints.has(IDS.NEW1)).toBe(true);
    expect(updatedModel.customerPoints.has(IDS.EXISTING1)).toBe(false);
    expect(updatedModel.customerPoints.has(IDS.EXISTING2)).toBe(false);

    const j1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints(IDS.J1);
    const j2CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints(IDS.J2);

    expect(Array.from(j1CustomerPoints)).toHaveLength(1);
    expect(Array.from(j1CustomerPoints)[0]?.id).toBe(IDS.NEW1);
    expect(Array.from(j2CustomerPoints)).toHaveLength(0);
  });

  it("preserves existing customer points when overrideExisting is false", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, EXISTING: 4, NEW1: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aCustomerPoint(IDS.EXISTING, {
        coordinates: [1, 1],
        demand: 10,
        connection: {
          pipeId: IDS.P1,
          junctionId: IDS.J1,
          snapPoint: [1, 0],
        },
      })
      .build();

    const newCP = buildCustomerPoint(IDS.NEW1, {
      coordinates: [5, 1],
      demand: 100,
    });
    newCP.connect({
      pipeId: IDS.P1,
      snapPoint: [5, 0],
      junctionId: IDS.J2,
    });

    const updatedModel = addCustomerPoints(hydraulicModel, [newCP], {
      overrideExisting: false,
    });

    expect(updatedModel.customerPoints.size).toBe(2);
    expect(updatedModel.customerPoints.has(IDS.EXISTING)).toBe(true);
    expect(updatedModel.customerPoints.has(IDS.NEW1)).toBe(true);

    const j1CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints(IDS.J1);
    const j2CustomerPoints =
      updatedModel.customerPointsLookup.getCustomerPoints(IDS.J2);

    expect(Array.from(j1CustomerPoints)).toHaveLength(1);
    expect(Array.from(j2CustomerPoints)).toHaveLength(1);
  });

  it("clears customer points lookup when overrideExisting is true", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, EXISTING: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aCustomerPoint(IDS.EXISTING, {
        coordinates: [1, 1],
        demand: 10,
        connection: {
          pipeId: IDS.P1,
          junctionId: IDS.J1,
          snapPoint: [1, 0],
        },
      })
      .build();

    expect(hydraulicModel.customerPointsLookup.hasConnections(IDS.J1)).toBe(
      true,
    );

    const updatedModel = addCustomerPoints(hydraulicModel, [], {
      overrideExisting: true,
    });

    expect(updatedModel.customerPoints.size).toBe(0);
    expect(updatedModel.customerPointsLookup.hasConnections(IDS.J1)).toBe(
      false,
    );
  });
});

import { describe, it, expect } from "vitest";
import { addCustomerPoints } from "./add-customer-points";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";
import { CustomerPoint } from "@epanet-js/hydraulic-model";
import { Demand } from "@epanet-js/hydraulic-model";

describe("addCustomerPoints", () => {
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

  it("adds customer points to model", () => {
    const IDS = { J1: 1, CP1: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cpWithoutConnection = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
    });
    customerPointsToAdd.push(cpWithoutConnection);

    const updatedModel = addCustomerPoints(
      hydraulicModel,
      customerPointsToAdd,
      {
        customerPointDemands: new Map<number, Demand[]>([
          [IDS.CP1, [{ baseDemand: 25 }]],
        ]),
      },
    );

    expect(updatedModel.customerPoints.size).toBe(1);
    expect(updatedModel.customerPoints.has(IDS.CP1)).toBe(true);

    expect(updatedModel.customerPointsLookup.hasConnections(IDS.J1)).toBe(
      false,
    );
  });

  it("skips customer points with invalid junction references", () => {
    const IDS = { J1: 1, CP1: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cpWithInvalidJunction = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
    });

    cpWithInvalidJunction.connect({
      pipeId: 999,
      snapPoint: [2, 0],
      junctionId: 998,
    });

    customerPointsToAdd.push(cpWithInvalidJunction);

    const updatedModel = addCustomerPoints(
      hydraulicModel,
      customerPointsToAdd,
      {
        customerPointDemands: new Map<number, Demand[]>([
          [IDS.CP1, [{ baseDemand: 25 }]],
        ]),
      },
    );

    expect(updatedModel.customerPoints.size).toBe(1);
    expect(updatedModel.customerPoints.has(IDS.CP1)).toBe(true);

    expect(updatedModel.customerPointsLookup.hasConnections(IDS.J1)).toBe(
      false,
    );
  });

  it("maintains immutability by returning a new hydraulic model", () => {
    const IDS = { J1: 1, CP1: 2 } as const;
    const originalModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cp1 = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
    });
    cp1.connect({
      pipeId: 999,
      snapPoint: [2, 0],
      junctionId: IDS.J1,
    });
    customerPointsToAdd.push(cp1);

    const updatedModel = addCustomerPoints(originalModel, customerPointsToAdd, {
      customerPointDemands: new Map<number, Demand[]>([
        [IDS.CP1, [{ baseDemand: 25 }]],
      ]),
    });

    expect(originalModel.customerPoints.size).toBe(0);
    expect(originalModel.customerPointsLookup.hasConnections(IDS.J1)).toBe(
      false,
    );

    expect(updatedModel.customerPoints.size).toBe(1);
    expect(updatedModel.customerPointsLookup.hasConnections(IDS.J1)).toBe(
      false,
    );

    expect(updatedModel).not.toBe(originalModel);
    expect(updatedModel.customerPoints).not.toBe(originalModel.customerPoints);
  });

  it("preserves junction base demands by default", () => {
    const IDS = { J1: 1, CP1: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunctionDemand(IDS.J1, [{ baseDemand: 30 }])
      .build();

    const customerPointsToAdd: CustomerPoint[] = [];

    const cp1 = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
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
        customerPointDemands: new Map<number, Demand[]>([
          [IDS.CP1, [{ baseDemand: 25 }]],
        ]),
      },
    );

    expect(updatedModel.demands.junctions.get(IDS.J1)).toEqual([
      { baseDemand: 30 },
    ]);
  });

  it("resets junction base demands for all junctions when preserveJunctionDemands is false", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
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
      .aJunctionDemand(IDS.J1, [{ baseDemand: 60 }])
      .aJunctionDemand(IDS.J2, [{ baseDemand: 40 }])
      .build();

    const cp1 = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
    });
    cp1.connect({
      pipeId: IDS.P1,
      snapPoint: [2, 0],
      junctionId: IDS.J1,
    });

    const updatedModel = addCustomerPoints(hydraulicModel, [cp1], {
      preserveJunctionDemands: false,
      customerPointDemands: new Map<number, Demand[]>([
        [IDS.CP1, [{ baseDemand: 35 }]],
      ]),
    });

    expect(updatedModel.demands.junctions.has(IDS.J1)).toBe(false);
    expect(updatedModel.demands.junctions.has(IDS.J2)).toBe(false);
    expect(updatedModel.demands.junctions.size).toBe(0);
  });

  it("clears existing customer points lookup", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, EXISTING: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aCustomerPoint(IDS.EXISTING, {
        coordinates: [1, 1],
        connection: {
          pipeId: IDS.P1,
          junctionId: IDS.J1,
          snapPoint: [1, 0],
        },
      })
      .aCustomerPointDemand(IDS.EXISTING, [{ baseDemand: 10 }])
      .build();

    expect(hydraulicModel.customerPointsLookup.hasConnections(IDS.J1)).toBe(
      true,
    );

    const updatedModel = addCustomerPoints(hydraulicModel, []);

    expect(updatedModel.customerPoints.size).toBe(0);
    expect(updatedModel.customerPointsLookup.hasConnections(IDS.J1)).toBe(
      false,
    );
  });
});

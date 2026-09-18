import { describe, it, expect } from "vitest";
import { removeCustomerPoints } from "./remove-customer-points";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";
import { applyOperation } from "src/__helpers__/apply-operation";
import { buildTestFactories } from "src/__helpers__/test-factories";

describe("removeCustomerPoints", () => {
  it("removes a single connected customer point", () => {
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
      .aCustomerPoint(IDS.CP1, {
        coordinates: [2, 1],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .build();

    const result = removeCustomerPoints(hydraulicModel, {
      customerPointIds: [IDS.CP1],
    });

    expect(result.deleteCustomerPoints).toEqual([IDS.CP1]);
    expect(result.putAssets).toBeUndefined();
    expect(result.deleteAssets).toBeUndefined();
  });

  it("removes multiple customer points", () => {
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
      .aCustomerPoint(IDS.CP1, {
        coordinates: [2, 1],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .aCustomerPoint(IDS.CP2, {
        coordinates: [8, 1],
        connection: { pipeId: IDS.P1, junctionId: IDS.J2 },
      })
      .build();

    const result = removeCustomerPoints(hydraulicModel, {
      customerPointIds: [IDS.CP1, IDS.CP2],
    });

    expect(result.deleteCustomerPoints).toEqual([IDS.CP1, IDS.CP2]);
  });

  it("clears demands when removing a CP with demands", () => {
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
      .aCustomerPoint(IDS.CP1, {
        coordinates: [2, 1],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .aCustomerPointDemand(IDS.CP1, [{ baseDemand: 25 }])
      .build();

    const result = removeCustomerPoints(hydraulicModel, {
      customerPointIds: [IDS.CP1],
    });

    expect(result.putDemands).toBeDefined();
    expect(result.putDemands!.assignments).toEqual([
      { customerPointId: IDS.CP1, demands: [] },
    ]);
  });

  it("does not include putDemands when CP has no demands", () => {
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
      .aCustomerPoint(IDS.CP1, {
        coordinates: [2, 1],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .build();

    const result = removeCustomerPoints(hydraulicModel, {
      customerPointIds: [IDS.CP1],
    });

    expect(result.putDemands).toBeUndefined();
  });

  it("throws error for non-existent customer point", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    expect(() => {
      removeCustomerPoints(hydraulicModel, {
        customerPointIds: [999],
      });
    }).toThrow("Customer point with id 999 not found");
  });

  it("returns correct note", () => {
    const IDS = { J1: 1, CP1: 2 } as const;
    const cp = buildCustomerPoint(IDS.CP1, {
      coordinates: [0, 0],
    });

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .build();

    hydraulicModel.customerPoints.set(IDS.CP1, cp);

    const result = removeCustomerPoints(hydraulicModel, {
      customerPointIds: [IDS.CP1],
    });

    expect(result.note).toBe("Remove customer points");
  });

  it("removes already-disconnected customer point", () => {
    const IDS = { J1: 1, CP1: 2 } as const;
    const disconnectedCP = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
    });

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .build();

    hydraulicModel.customerPoints.set(IDS.CP1, disconnectedCP);

    const result = removeCustomerPoints(hydraulicModel, {
      customerPointIds: [IDS.CP1],
    });

    expect(result.deleteCustomerPoints).toEqual([IDS.CP1]);
  });

  it("restores the customer point and its demands on undo", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const { labelManager } = buildTestFactories();
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
      .aCustomerPoint(IDS.CP1, {
        coordinates: [2, 1],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .aCustomerPointDemand(IDS.CP1, [{ baseDemand: 25 }])
      .build();

    const originalCP = hydraulicModel.customerPoints.get(IDS.CP1)!;
    const moment = removeCustomerPoints(hydraulicModel, {
      customerPointIds: [IDS.CP1],
    });

    const { undo } = applyOperation(hydraulicModel, moment, labelManager);

    expect(hydraulicModel.customerPoints.has(IDS.CP1)).toBe(false);

    undo();

    const restoredCP = hydraulicModel.customerPoints.get(IDS.CP1);
    expect(restoredCP).toBeDefined();
    expect(restoredCP!.coordinates).toEqual(originalCP.coordinates);
    expect(hydraulicModel.demands.customerPoints.get(IDS.CP1)).toEqual([
      { baseDemand: 25 },
    ]);
  });
});

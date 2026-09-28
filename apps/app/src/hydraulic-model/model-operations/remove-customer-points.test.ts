import { describe, it, expect } from "vitest";
import { removeCustomerPoints } from "./remove-customer-points";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";
import { applyOperation } from "src/__helpers__/apply-operation";
import { buildTestFactories } from "src/__helpers__/test-factories";
import type { HydraulicModel } from "src/hydraulic-model";
import { getCustomerPointDemands } from "@epanet-js/hydraulic-model";

const { labelManager } = buildTestFactories();

const remove = (hydraulicModel: HydraulicModel, customerPointIds: number[]) => {
  const changeSet = removeCustomerPoints(hydraulicModel, { customerPointIds });
  applyOperation(hydraulicModel, changeSet, labelManager);
  return changeSet;
};

const changedEntities = (changeSet: ReturnType<typeof remove>) =>
  changeSet.summary().map(({ entity, kind }) => `${entity}:${kind}`);

describe("removeCustomerPoints", () => {
  it("removes a single connected customer point", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
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
      .build();

    const changeSet = remove(hydraulicModel, [IDS.CP1]);

    expect(hydraulicModel.customerPoints.has(IDS.CP1)).toBe(false);
    expect(changedEntities(changeSet)).toEqual(["customerPoint:delete"]);
  });

  it("removes multiple customer points", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4, CP2: 5 } as const;
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
      .aCustomerPoint(IDS.CP2, {
        coordinates: [8, 1],
        connection: { pipeId: IDS.P1, junctionId: IDS.J2 },
      })
      .build();

    remove(hydraulicModel, [IDS.CP1, IDS.CP2]);

    expect(hydraulicModel.customerPoints.has(IDS.CP1)).toBe(false);
    expect(hydraulicModel.customerPoints.has(IDS.CP2)).toBe(false);
  });

  it("clears demands when removing a CP with demands", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
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

    const changeSet = remove(hydraulicModel, [IDS.CP1]);

    expect(changedEntities(changeSet)).toContain("customerDemand:update");
    expect(getCustomerPointDemands(hydraulicModel.demands, IDS.CP1)).toEqual(
      [],
    );
  });

  it("does not change demands when CP has no demands", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
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
      .build();

    const changeSet = remove(hydraulicModel, [IDS.CP1]);

    expect(changedEntities(changeSet)).toEqual(["customerPoint:delete"]);
  });

  it("throws error for non-existent customer point", () => {
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    expect(() => {
      removeCustomerPoints(hydraulicModel, {
        customerPointIds: [999],
      });
    }).toThrow("Customer point with id 999 not found");
  });

  it("names the change", () => {
    const IDS = { J1: 1, CP1: 2 } as const;
    const cp = buildCustomerPoint(IDS.CP1, {
      coordinates: [0, 0],
    });

    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .build();

    hydraulicModel.customerPoints.set(IDS.CP1, cp);

    const changeSet = removeCustomerPoints(hydraulicModel, {
      customerPointIds: [IDS.CP1],
    });

    expect(changeSet.name).toBe("Remove customer points");
  });

  it("removes already-disconnected customer point", () => {
    const IDS = { J1: 1, CP1: 2 } as const;
    const disconnectedCP = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
    });

    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .build();

    hydraulicModel.customerPoints.set(IDS.CP1, disconnectedCP);

    remove(hydraulicModel, [IDS.CP1]);

    expect(hydraulicModel.customerPoints.has(IDS.CP1)).toBe(false);
  });

  it("restores the customer point and its demands on undo", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
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
    const changeSet = removeCustomerPoints(hydraulicModel, {
      customerPointIds: [IDS.CP1],
    });

    const { undo } = applyOperation(hydraulicModel, changeSet, labelManager);

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

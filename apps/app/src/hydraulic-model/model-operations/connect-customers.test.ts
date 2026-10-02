import { describe, it, expect } from "vitest";
import { connectCustomers } from "./connect-customers";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildTestFactories } from "src/__helpers__/test-factories";
import { applyOperation } from "src/__helpers__/apply-operation";
import type { HydraulicModel } from "src/hydraulic-model";

const { labelManager } = buildTestFactories();

const connect = (
  hydraulicModel: HydraulicModel,
  data: Parameters<typeof connectCustomers>[1],
) => {
  const changeSet = connectCustomers(hydraulicModel, data);
  applyOperation(hydraulicModel, changeSet, labelManager);
  return changeSet;
};

describe("connectCustomers", () => {
  it("connects a single customer point to closest junction", () => {
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
      })
      .build();

    const changeSet = connect(hydraulicModel, {
      customerPointIds: [IDS.CP1],
      pipeId: IDS.P1,
      snapPoints: [[2, 0]], // closer to J1
    });

    expect(changeSet.records.map(({ entity, id }) => [entity, id])).toEqual([
      ["customerPoint", IDS.CP1],
    ]);

    const connectedCP = hydraulicModel.customerPoints.get(IDS.CP1)!;
    expect(connectedCP.coordinates).toEqual([2, 1]);
    expect(connectedCP.connection).not.toBeNull();
    expect(connectedCP.connection!.pipeId).toBe(IDS.P1);
    expect(connectedCP.connection!.junctionId).toBe(IDS.J1);
    expect(connectedCP.connection!.snapPoint).toEqual([2, 0]);
  });

  it("connects multiple customer points to same pipe", () => {
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
      })
      .aCustomerPoint(IDS.CP2, {
        coordinates: [8, 1],
      })
      .build();

    const changeSet = connect(hydraulicModel, {
      customerPointIds: [IDS.CP1, IDS.CP2],
      pipeId: IDS.P1,
      snapPoints: [
        [2, 0],
        [8, 0],
      ], // CP1 closer to J1, CP2 closer to J2
    });

    expect(changeSet.records).toHaveLength(2);

    const connectedCP1 = hydraulicModel.customerPoints.get(IDS.CP1)!;
    const connectedCP2 = hydraulicModel.customerPoints.get(IDS.CP2)!;

    expect(connectedCP1.connection!.junctionId).toBe(IDS.J1);
    expect(connectedCP2.connection!.junctionId).toBe(IDS.J2);

    expect(changeSet.name).toBe("connectCustomers");
  });

  it("moves customer point from existing connection", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5, CP1: 6 } as const;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aJunction(IDS.J3, { coordinates: [5, 10] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J3,
        coordinates: [
          [0, 0],
          [5, 10],
        ],
      })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [2, 5],
        connection: { pipeId: IDS.P2, junctionId: IDS.J1 },
      })
      .build();

    connect(hydraulicModel, {
      customerPointIds: [IDS.CP1],
      pipeId: IDS.P1,
      snapPoints: [[8, 0]], // closer to J2 on P1
    });

    const connectedCP = hydraulicModel.customerPoints.get(IDS.CP1)!;
    expect(connectedCP.connection!.pipeId).toBe(IDS.P1);
    expect(connectedCP.connection!.junctionId).toBe(IDS.J2);
  });

  it("throws error for non-existent customer point", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
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
      .build();

    expect(() => {
      connectCustomers(hydraulicModel, {
        customerPointIds: [999],
        pipeId: IDS.P1,
        snapPoints: [[5, 0]],
      });
    }).toThrow("Customer point with id 999 not found");
  });

  it("throws error for non-existent pipe", () => {
    const IDS = { J1: 1, CP1: 2 } as const;
    const NonExistentPipeId = 3;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [2, 1],
      })
      .build();

    expect(() => {
      connectCustomers(hydraulicModel, {
        customerPointIds: [IDS.CP1],
        pipeId: NonExistentPipeId,
        snapPoints: [[5, 0]],
      });
    }).toThrow("Pipe with id 3 not found");
  });

  it("throws error when customer point IDs and snap points length mismatch", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
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
      .build();

    expect(() => {
      connectCustomers(hydraulicModel, {
        customerPointIds: [4, 5],
        pipeId: IDS.P1,
        snapPoints: [[5, 0]], // Only one snap point for two customer points
      });
    }).toThrow(
      "Customer point IDs and snap points arrays must have the same length",
    );
  });

  it("throws error when pipe has no junction endpoints", () => {
    const IDS = { R1: 1, T1: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aReservoir(IDS.R1, { coordinates: [0, 0] })
      .aTank(IDS.T1, { coordinates: [10, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.R1,
        endNodeId: IDS.T1,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [5, 1],
      })
      .build();

    expect(() => {
      connectCustomers(hydraulicModel, {
        customerPointIds: [IDS.CP1],
        pipeId: IDS.P1,
        snapPoints: [[5, 0]],
      });
    }).toThrow(
      `No junction found to connect customer point ${IDS.CP1} to pipe ${IDS.P1}`,
    );
  });

  it("ensures immutability by creating new instances", () => {
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
      })
      .build();

    const originalCP = hydraulicModel.customerPoints.get(IDS.CP1)!;

    connect(hydraulicModel, {
      customerPointIds: [IDS.CP1],
      pipeId: IDS.P1,
      snapPoints: [[2, 0]],
    });

    const connectedCP = hydraulicModel.customerPoints.get(IDS.CP1)!;

    expect(connectedCP).not.toBe(originalCP);
    expect(connectedCP.id).toBe(originalCP.id);
    expect(connectedCP.coordinates).toEqual(originalCP.coordinates);
    expect(connectedCP.connection).not.toBeNull();
    expect(originalCP.connection).toBeNull();
  });

  it("handles connecting multiple customer points to same junction", () => {
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
        coordinates: [1, 1],
      })
      .aCustomerPoint(IDS.CP2, {
        coordinates: [2, 1],
      })
      .build();

    const changeSet = connect(hydraulicModel, {
      customerPointIds: [IDS.CP1, IDS.CP2],
      pipeId: IDS.P1,
      snapPoints: [
        [1, 0],
        [2, 0],
      ], // Both closer to J1
    });

    expect(changeSet.records).toHaveLength(2);

    const connectedCP1 = hydraulicModel.customerPoints.get(IDS.CP1)!;
    const connectedCP2 = hydraulicModel.customerPoints.get(IDS.CP2)!;

    expect(connectedCP1.connection!.junctionId).toBe(IDS.J1);
    expect(connectedCP2.connection!.junctionId).toBe(IDS.J1);
  });
});

import { describe, it, expect } from "vitest";
import { applyCustomerPointAllocation } from "./apply-customer-point-allocation";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";
import { CustomerPoints } from "@epanet-js/hydraulic-model";
import { buildTestFactories } from "src/__helpers__/test-factories";
import { applyOperation } from "src/__helpers__/apply-operation";
import type { HydraulicModel } from "src/hydraulic-model";

const { labelManager } = buildTestFactories();

const allocate = (
  hydraulicModel: HydraulicModel,
  data: Parameters<typeof applyCustomerPointAllocation>[1],
) => {
  const changeSet = applyCustomerPointAllocation(hydraulicModel, data);
  applyOperation(hydraulicModel, changeSet, labelManager);
  return changeSet;
};

describe("applyCustomerPointAllocation", () => {
  it("connects customer points from multiple pipes into a single change set", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6 } as const;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aJunction(IDS.J3, { coordinates: [20, 0] })
      .aJunction(IDS.J4, { coordinates: [30, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 12,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J3,
        endNodeId: IDS.J4,
        diameter: 12,
        coordinates: [
          [20, 0],
          [30, 0],
        ],
      })
      .aCustomerPoint(100, { coordinates: [5, 0] })
      .aCustomerPoint(101, { coordinates: [25, 0] })
      .build();

    const cp1 = buildCustomerPoint(100, { coordinates: [5, 0] });
    cp1.connect({ pipeId: IDS.P1, snapPoint: [5, 0], junctionId: IDS.J1 });

    const cp2 = buildCustomerPoint(101, { coordinates: [25, 0] });
    cp2.connect({ pipeId: IDS.P2, snapPoint: [25, 0], junctionId: IDS.J3 });

    const allocatedCustomerPoints: CustomerPoints = new Map([
      [100, cp1],
      [101, cp2],
    ]);

    const changeSet = allocate(hydraulicModel, {
      allocationResult: {
        allocatedCustomerPoints,
        disconnectedCustomerPoints: new Map(),
        customerPointsMatchedToZone: 0,
        ruleMatches: [2],
      },
    });

    expect(changeSet.records).toHaveLength(2);
    expect(changeSet.name).toBe("applyCustomerPointAllocation");
    expect(hydraulicModel.customerPoints.get(100)!.connection!.pipeId).toBe(
      IDS.P1,
    );
    expect(hydraulicModel.customerPoints.get(101)!.connection!.pipeId).toBe(
      IDS.P2,
    );
  });

  it("includes all customer points connected to the same pipe", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 12,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aCustomerPoint(100, { coordinates: [3, 0] })
      .aCustomerPoint(101, { coordinates: [7, 0] })
      .build();

    const cp1 = buildCustomerPoint(100, { coordinates: [3, 0] });
    cp1.connect({ pipeId: IDS.P1, snapPoint: [3, 0], junctionId: IDS.J1 });

    const cp2 = buildCustomerPoint(101, { coordinates: [7, 0] });
    cp2.connect({ pipeId: IDS.P1, snapPoint: [7, 0], junctionId: IDS.J2 });

    const allocatedCustomerPoints: CustomerPoints = new Map([
      [100, cp1],
      [101, cp2],
    ]);

    const changeSet = allocate(hydraulicModel, {
      allocationResult: {
        allocatedCustomerPoints,
        disconnectedCustomerPoints: new Map(),
        customerPointsMatchedToZone: 0,
        ruleMatches: [2],
      },
    });

    expect(changeSet.records).toHaveLength(2);
    expect(hydraulicModel.customerPoints.get(100)!.connection!.junctionId).toBe(
      IDS.J1,
    );
    expect(hydraulicModel.customerPoints.get(101)!.connection!.junctionId).toBe(
      IDS.J2,
    );
  });

  it("returns an empty change set when no customer points were allocated", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 12,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    const changeSet = allocate(hydraulicModel, {
      allocationResult: {
        allocatedCustomerPoints: new Map(),
        disconnectedCustomerPoints: new Map(),
        customerPointsMatchedToZone: 0,
        ruleMatches: [0],
      },
    });

    expect(changeSet.size).toBe(0);
  });

  it("ignores disconnected customer points", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 12,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aCustomerPoint(100, { coordinates: [3, 0] })
      .aCustomerPoint(101, { coordinates: [50, 50] })
      .build();

    const cp1 = buildCustomerPoint(100, { coordinates: [3, 0] });
    cp1.connect({ pipeId: IDS.P1, snapPoint: [3, 0], junctionId: IDS.J1 });

    const disconnectedCp = buildCustomerPoint(101, { coordinates: [50, 50] });

    const changeSet = allocate(hydraulicModel, {
      allocationResult: {
        allocatedCustomerPoints: new Map([[100, cp1]]),
        disconnectedCustomerPoints: new Map([[101, disconnectedCp]]),
        customerPointsMatchedToZone: 0,
        ruleMatches: [1],
      },
    });

    expect(changeSet.records.map(({ id }) => id)).toEqual([100]);
    expect(hydraulicModel.customerPoints.get(101)!.connection).toBeNull();
  });
});

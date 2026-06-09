import { describe, it, expect } from "vitest";
import { applyAllocationResult } from "./apply-allocation-result";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";
import { CustomerPoints } from "@epanet-js/hydraulic-model";

describe("applyAllocationResult", () => {
  it("connects customer points from multiple pipes into a single moment", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
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

    const moment = applyAllocationResult(hydraulicModel, {
      allocatedCustomerPoints,
      disconnectedCustomerPoints: new Map(),
      ruleMatches: [2],
    });

    expect(moment.putCustomerPoints).toHaveLength(2);
    expect(moment.note).toBe("Allocate customer points");
  });

  it("includes all customer points connected to the same pipe", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
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

    const moment = applyAllocationResult(hydraulicModel, {
      allocatedCustomerPoints,
      disconnectedCustomerPoints: new Map(),
      ruleMatches: [2],
    });

    expect(moment.putCustomerPoints).toHaveLength(2);
  });

  it("returns empty putCustomerPoints when no customer points were allocated", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
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

    const moment = applyAllocationResult(hydraulicModel, {
      allocatedCustomerPoints: new Map(),
      disconnectedCustomerPoints: new Map(),
      ruleMatches: [0],
    });

    expect(moment.putCustomerPoints).toHaveLength(0);
  });

  it("ignores disconnected customer points", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
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

    const moment = applyAllocationResult(hydraulicModel, {
      allocatedCustomerPoints: new Map([[100, cp1]]),
      disconnectedCustomerPoints: new Map([[101, disconnectedCp]]),
      ruleMatches: [1],
    });

    expect(moment.putCustomerPoints).toHaveLength(1);
  });
});

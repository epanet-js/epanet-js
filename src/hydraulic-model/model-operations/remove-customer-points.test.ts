import { describe, it, expect } from "vitest";
import { removeCustomerPoints } from "./remove-customer-points";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";
import { applyMomentToModel } from "../mutations/apply-moment";
import { LabelManager } from "src/hydraulic-model/label-manager";

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

  it("produces correct reverse moment for undo", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const labelManager = new LabelManager();
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

    const reverseMoment = applyMomentToModel(
      hydraulicModel,
      moment,
      labelManager,
    );

    // CP should be removed from model
    expect(hydraulicModel.customerPoints.has(IDS.CP1)).toBe(false);

    // Reverse moment should restore the CP
    expect(reverseMoment.putCustomerPoints).toHaveLength(1);
    expect(reverseMoment.putCustomerPoints[0].id).toBe(originalCP.id);
    expect(reverseMoment.putCustomerPoints[0].coordinates).toEqual(
      originalCP.coordinates,
    );

    // Reverse moment should restore demands
    expect(reverseMoment.putDemands).toBeDefined();
    expect(reverseMoment.putDemands!.assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          customerPointId: IDS.CP1,
          demands: [{ baseDemand: 25 }],
        }),
      ]),
    );

    // Applying reverse should restore the CP
    applyMomentToModel(hydraulicModel, reverseMoment, labelManager);
    expect(hydraulicModel.customerPoints.has(IDS.CP1)).toBe(true);
    expect(hydraulicModel.customerPoints.get(IDS.CP1)!.id).toBe(IDS.CP1);
  });
});

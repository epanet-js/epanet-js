import { describe, it, expect } from "vitest";
import { changeCustomerPointLabel } from "./change-customer-point-label";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { applyMomentToModel } from "../mutations/apply-moment";

describe("changeCustomerPointLabel", () => {
  it("changes a customer point label", () => {
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

    const result = changeCustomerPointLabel(hydraulicModel, {
      customerPointId: IDS.CP1,
      newLabel: "MyCustomer",
    });

    expect(result.putCustomerPoints).toHaveLength(1);
    expect(result.putCustomerPoints![0].label).toBe("MyCustomer");
    expect(result.putCustomerPoints![0].id).toBe(IDS.CP1);
  });

  it("preserves connection data", () => {
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

    const result = changeCustomerPointLabel(hydraulicModel, {
      customerPointId: IDS.CP1,
      newLabel: "Renamed",
    });

    const updated = result.putCustomerPoints![0];
    expect(updated.connection).not.toBeNull();
    expect(updated.connection!.pipeId).toBe(IDS.P1);
    expect(updated.connection!.junctionId).toBe(IDS.J1);
  });

  it("throws for non-existent customer point", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(1, { coordinates: [0, 0] })
      .build();

    expect(() => {
      changeCustomerPointLabel(hydraulicModel, {
        customerPointId: 999,
        newLabel: "Test",
      });
    }).toThrow("Customer point 999 not found");
  });

  it("updates label manager after apply", () => {
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

    const moment = changeCustomerPointLabel(hydraulicModel, {
      customerPointId: IDS.CP1,
      newLabel: "NewLabel",
    });
    applyMomentToModel(hydraulicModel, moment, hydraulicModel.labelManager);

    expect(hydraulicModel.customerPoints.get(IDS.CP1)!.label).toBe("NewLabel");
    expect(
      hydraulicModel.labelManager.isLabelAvailable(
        "NewLabel",
        "customerPoint",
        IDS.CP1,
      ),
    ).toBe(true);
    expect(
      hydraulicModel.labelManager.isLabelAvailable("NewLabel", "customerPoint"),
    ).toBe(false);
  });

  it("produces correct reverse moment for undo", () => {
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
        label: "Original",
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .build();

    const moment = changeCustomerPointLabel(hydraulicModel, {
      customerPointId: IDS.CP1,
      newLabel: "Changed",
    });
    const reverseMoment = applyMomentToModel(
      hydraulicModel,
      moment,
      hydraulicModel.labelManager,
    );

    expect(hydraulicModel.customerPoints.get(IDS.CP1)!.label).toBe("Changed");

    applyMomentToModel(
      hydraulicModel,
      reverseMoment,
      hydraulicModel.labelManager,
    );
    expect(hydraulicModel.customerPoints.get(IDS.CP1)!.label).toBe("Original");
  });
});

import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildTestFactories } from "src/__helpers__/test-factories";
import { applyOperation } from "src/__helpers__/apply-operation";
import {
  changeCustomerPointProperty,
  changeCustomerPointProperties,
} from "./change-customer-point-property";
import { changeCustomerPointLabel } from "./change-customer-point-label";

const IDS = { CP1: 1 } as const;

const { labelManager } = buildTestFactories();

describe("changeCustomerPointProperty", () => {
  it("changes the label", () => {
    const model = HydraulicModelBuilder.with({ labelManager })
      .aCustomerPoint(IDS.CP1, { label: "old" })
      .build();

    const changeSet = changeCustomerPointProperty(model, {
      customerPointIds: [IDS.CP1],
      property: "label",
      value: "new",
    });
    applyOperation(model, changeSet, labelManager);

    expect(model.customerPoints.get(IDS.CP1)!.label).toBe("new");
  });

  it("keeps custom-<id> keys even when not present yet", () => {
    const model = HydraulicModelBuilder.with({ labelManager })
      .aCustomerPoint(IDS.CP1, { label: "old" })
      .build();

    const changeSet = changeCustomerPointProperty(model, {
      customerPointIds: [IDS.CP1],
      property: "custom-1",
      value: "north",
    });
    applyOperation(model, changeSet, labelManager);

    expect(model.customerPoints.get(IDS.CP1)!.getProperty("custom-1")).toBe(
      "north",
    );
  });

  it("throws when the customer point does not exist", () => {
    const model = HydraulicModelBuilder.with().build();

    expect(() =>
      changeCustomerPointProperty(model, {
        customerPointIds: [IDS.CP1],
        property: "label",
        value: "new",
      }),
    ).toThrow(/Customer point 1 not found/);
  });
});

describe("changeCustomerPointProperties", () => {
  it("applies multiple custom changes in one record", () => {
    const model = HydraulicModelBuilder.with({ labelManager })
      .aCustomAttribute("customerPoint", {
        id: "custom-1",
        label: "Zone",
        type: "text",
      })
      .aCustomAttribute("customerPoint", {
        id: "custom-2",
        label: "Age",
        type: "number",
      })
      .aCustomerPoint(IDS.CP1, { label: "old" })
      .build();

    const changeSet = changeCustomerPointProperties(model, {
      customerPointIds: [IDS.CP1],
      changes: [
        { property: "custom-1", value: "north" },
        { property: "custom-2", value: 5 },
      ],
    });
    applyOperation(model, changeSet, labelManager);

    expect(changeSet.records).toHaveLength(1);
    const customerPoint = model.customerPoints.get(IDS.CP1)!;
    expect(customerPoint.getProperty("custom-1")).toBe("north");
    expect(customerPoint.getProperty("custom-2")).toBe(5);
  });
});

describe("changeCustomerPointLabel", () => {
  it("delegates to the patch channel", () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(IDS.CP1, { label: "old" })
      .build();

    const moment = changeCustomerPointLabel(model, {
      customerPointId: IDS.CP1,
      newLabel: "new",
    });

    expect(moment.patchCustomerPointsAttributes).toEqual([
      { id: IDS.CP1, properties: { label: "new" } },
    ]);
    expect(moment.putCustomerPoints).toBeUndefined();
  });
});

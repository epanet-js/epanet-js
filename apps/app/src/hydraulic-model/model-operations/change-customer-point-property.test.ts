import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  changeCustomerPointProperty,
  changeCustomerPointProperties,
} from "./change-customer-point-property";
import { changeCustomerPointLabel } from "./change-customer-point-label";

const IDS = { CP1: 1 } as const;

describe("changeCustomerPointProperty", () => {
  it("builds a customer point patch for the label", () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(IDS.CP1, { label: "old" })
      .build();

    const moment = changeCustomerPointProperty(model, {
      customerPointIds: [IDS.CP1],
      property: "label",
      value: "new",
    });

    expect(moment.patchCustomerPointsAttributes).toEqual([
      { id: IDS.CP1, properties: { label: "new" } },
    ]);
  });

  it("keeps custom-<id> keys even when not present yet", () => {
    const model = HydraulicModelBuilder.with()
      .aCustomerPoint(IDS.CP1, { label: "old" })
      .build();

    const moment = changeCustomerPointProperty(model, {
      customerPointIds: [IDS.CP1],
      property: "custom-1",
      value: "north",
    });

    expect(moment.patchCustomerPointsAttributes).toEqual([
      { id: IDS.CP1, properties: { "custom-1": "north" } },
    ]);
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
  it("builds a single patch with multiple custom changes", () => {
    const model = HydraulicModelBuilder.with()
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

    const moment = changeCustomerPointProperties(model, {
      customerPointIds: [IDS.CP1],
      changes: [
        { property: "custom-1", value: "north" },
        { property: "custom-2", value: 5 },
      ],
    });

    expect(moment.patchCustomerPointsAttributes).toEqual([
      { id: IDS.CP1, properties: { "custom-1": "north", "custom-2": 5 } },
    ]);
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

import {
  emptyCustomAttributesDefinition,
  getAttributes,
  setAttributes,
} from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { changeCustomAttributesDefinition } from "./change-custom-attributes-definition";

describe("change custom attributes definition", () => {
  it("sets the next definition and emits no patches when adding attributes", () => {
    const hydraulicModel = HydraulicModelBuilder.with().aJunction(1).build();
    const next = setAttributes(emptyCustomAttributesDefinition(), "junction", [
      { id: "custom-1", label: "Zone", type: "text" },
    ]);

    const moment = changeCustomAttributesDefinition(hydraulicModel, next);

    expect(moment.putCustomAttributesDefinition).toBe(next);
    expect(moment.patchAssetsAttributes).toHaveLength(0);
  });

  it("emits null patches only for assets that hold a removed attribute", () => {
    const IDS = { WITH: 1, WITHOUT: 2 } as const;
    const previous = setAttributes(
      emptyCustomAttributesDefinition(),
      "junction",
      [{ id: "custom-1", label: "Zone", type: "text" }],
    );
    const hydraulicModel = HydraulicModelBuilder.with()
      .aCustomAttribute("junction", {
        id: "custom-1",
        label: "Zone",
        type: "text",
      })
      .aJunction(IDS.WITH)
      .aJunction(IDS.WITHOUT)
      .build();
    hydraulicModel.customAttributes = previous;
    hydraulicModel.assets.get(IDS.WITH)!.setProperty("custom-1", "north");

    const next = emptyCustomAttributesDefinition();
    const moment = changeCustomAttributesDefinition(hydraulicModel, next);

    expect(moment.putCustomAttributesDefinition).toBe(next);
    expect(moment.patchAssetsAttributes).toEqual([
      {
        id: IDS.WITH,
        type: "junction",
        properties: { "custom-1": null },
      },
    ]);
  });

  it("clears removed attribute values on customer points too", () => {
    const IDS = { CP1: 1 } as const;
    const previous = setAttributes(
      emptyCustomAttributesDefinition(),
      "customerPoint",
      [{ id: "custom-1", label: "Zone", type: "text" }],
    );
    const hydraulicModel = HydraulicModelBuilder.with()
      .aCustomAttribute("customerPoint", {
        id: "custom-1",
        label: "Zone",
        type: "text",
      })
      .aCustomerPoint(IDS.CP1, { label: "CP1" })
      .build();
    hydraulicModel.customAttributes = previous;
    hydraulicModel.customerPoints
      .get(IDS.CP1)!
      .setProperty("custom-1", "north");

    const next = emptyCustomAttributesDefinition();
    const moment = changeCustomAttributesDefinition(hydraulicModel, next);

    expect(moment.patchCustomerPointsAttributes).toEqual([
      { id: IDS.CP1, properties: { "custom-1": null } },
    ]);
  });

  it("emits no patches when only renaming an attribute", () => {
    const previous = setAttributes(
      emptyCustomAttributesDefinition(),
      "junction",
      [{ id: "custom-1", label: "Zone", type: "text" }],
    );
    const hydraulicModel = HydraulicModelBuilder.with().aJunction(1).build();
    hydraulicModel.customAttributes = previous;

    const next = setAttributes(emptyCustomAttributesDefinition(), "junction", [
      { id: "custom-1", label: "District", type: "text" },
    ]);
    const moment = changeCustomAttributesDefinition(hydraulicModel, next);

    expect(moment.patchAssetsAttributes).toHaveLength(0);
    expect(
      getAttributes(moment.putCustomAttributesDefinition!, "junction"),
    ).toEqual([{ id: "custom-1", label: "District", type: "text" }]);
  });
});

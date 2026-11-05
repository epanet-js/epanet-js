import {
  emptyCustomAttributesDefinition,
  getAttributes,
  setAttributes,
  type CustomAttributesDefinition,
  type HydraulicModel,
} from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { buildTestFactories } from "@epanet-js/hydraulic-model-testing";
import { applyOperation } from "../__helpers__/apply-operation";
import { changeCustomAttributesDefinition } from "./change-custom-attributes-definition";

const { labelManager } = buildTestFactories();

const run = (
  hydraulicModel: HydraulicModel,
  next: CustomAttributesDefinition,
) => {
  const changeSet = changeCustomAttributesDefinition(hydraulicModel, next);
  applyOperation(hydraulicModel, changeSet, labelManager);
  return changeSet;
};

const changedEntities = (changeSet: ReturnType<typeof run>) =>
  changeSet.records.map((record) => `${record.entity}/${record.id}`);

describe("change custom attributes definition", () => {
  it("sets the next definition and patches no values when adding attributes", () => {
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(1)
      .build();
    const next = setAttributes(emptyCustomAttributesDefinition(), "junction", [
      { id: "custom-1", label: "Zone", type: "text" },
    ]);

    const changeSet = run(hydraulicModel, next);

    expect(getAttributes(hydraulicModel.customAttributes, "junction")).toEqual([
      { id: "custom-1", label: "Zone", type: "text" },
    ]);
    expect(changedEntities(changeSet)).toEqual([
      "customAttributesDefinition/0",
    ]);
  });

  it("clears values only on assets that hold a removed attribute", () => {
    const IDS = { WITH: 1, WITHOUT: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aCustomAttribute("junction", {
        id: "custom-1",
        label: "Zone",
        type: "text",
      })
      .aJunction(IDS.WITH)
      .aJunction(IDS.WITHOUT)
      .build();
    hydraulicModel.assets.get(IDS.WITH)!.setProperty("custom-1", "NORTH");

    const changeSet = run(hydraulicModel, emptyCustomAttributesDefinition());

    expect(getAttributes(hydraulicModel.customAttributes, "junction")).toEqual(
      [],
    );
    expect(
      hydraulicModel.assets.get(IDS.WITH)!.getProperty("custom-1"),
    ).toBeNull();
    expect(changedEntities(changeSet)).toEqual([
      "customAttributesDefinition/0",
      `junction/${IDS.WITH}`,
    ]);
  });

  it("clears removed attribute values on customer points too", () => {
    const IDS = { CP1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aCustomAttribute("customerPoint", {
        id: "custom-1",
        label: "Zone",
        type: "text",
      })
      .aCustomerPoint(IDS.CP1, { label: "CP1" })
      .build();
    hydraulicModel.customerPoints
      .get(IDS.CP1)!
      .setProperty("custom-1", "NORTH");

    run(hydraulicModel, emptyCustomAttributesDefinition());

    expect(
      hydraulicModel.customerPoints.get(IDS.CP1)!.getProperty("custom-1"),
    ).toBeNull();
  });

  it("clears removed attribute values on zones too", () => {
    const IDS = { Z1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aCustomAttribute("zone", { id: "custom-1", label: "Area", type: "text" })
      .aZone({
        id: IDS.Z1,
        label: "NORTH",
        geometry: { type: "MultiPolygon", coordinates: [] },
        bbox: [0, 0, 1, 1],
        customAttributes: { "custom-1": "LOW" },
      })
      .build();

    run(hydraulicModel, emptyCustomAttributesDefinition());

    expect(
      hydraulicModel.zones.get(IDS.Z1)!.getProperty("custom-1"),
    ).toBeNull();
  });

  it("patches no values when only renaming an attribute", () => {
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aCustomAttribute("junction", {
        id: "custom-1",
        label: "Zone",
        type: "text",
      })
      .aJunction(1)
      .build();
    hydraulicModel.assets.get(1)!.setProperty("custom-1", "NORTH");

    const next = setAttributes(emptyCustomAttributesDefinition(), "junction", [
      { id: "custom-1", label: "District", type: "text" },
    ]);
    const changeSet = run(hydraulicModel, next);

    expect(changedEntities(changeSet)).toEqual([
      "customAttributesDefinition/0",
    ]);
    expect(getAttributes(hydraulicModel.customAttributes, "junction")).toEqual([
      { id: "custom-1", label: "District", type: "text" },
    ]);
    expect(hydraulicModel.assets.get(1)!.getProperty("custom-1")).toBe("NORTH");
  });
});

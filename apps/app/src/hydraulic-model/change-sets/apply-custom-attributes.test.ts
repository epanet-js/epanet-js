import { describe, it, expect } from "vitest";
import {
  emptyCustomAttributesDefinition,
  getAttributes,
  setAttributes,
} from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { applyOperation } from "src/__helpers__/apply-operation";
import { buildTestFactories } from "src/__helpers__/test-factories";
import { changeProperty } from "../model-operations/change-property";
import type { ChangeableProperty } from "../model-operations/change-property";
import { changeCustomAttributesDefinition } from "../model-operations/change-custom-attributes-definition";

describe("change sets for custom attributes", () => {
  it("applies the definition and restores it on undo", () => {
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(1)
      .build();

    const next = setAttributes(emptyCustomAttributesDefinition(), "junction", [
      { id: "custom-1", label: "Zone", type: "text" },
    ]);
    const { undo } = applyOperation(
      model,
      changeCustomAttributesDefinition(model, next),
      labelManager,
    );

    expect(getAttributes(model.customAttributes, "junction")).toEqual([
      { id: "custom-1", label: "Zone", type: "text" },
    ]);

    undo();

    expect(getAttributes(model.customAttributes, "junction")).toEqual([]);
  });

  it("round-trips a custom-<id> value through undo then redo", () => {
    const IDS = { J1: 1 } as const;
    const key = "custom-1" as ChangeableProperty;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aCustomAttribute("junction", {
        id: "custom-1",
        label: "Zone",
        type: "text",
      })
      .aJunction(IDS.J1)
      .build();

    const forward = changeProperty(model, {
      assetIds: [IDS.J1],
      property: key,
      value: "north" as never,
    });
    const { undo, redo } = applyOperation(model, forward, labelManager);

    expect(model.assets.get(IDS.J1)!.getProperty(key)).toBe("north");

    undo();
    expect(model.assets.get(IDS.J1)!.getProperty(key)).toBeUndefined();

    redo();
    expect(model.assets.get(IDS.J1)!.getProperty(key)).toBe("north");
  });

  it("clears custom values across assets when an attribute is removed", () => {
    const IDS = { J1: 1 } as const;
    const key = "custom-1";
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aCustomAttribute("junction", {
        id: "custom-1",
        label: "Zone",
        type: "text",
      })
      .aJunction(IDS.J1)
      .build();
    model.assets.get(IDS.J1)!.setProperty(key, "north");

    applyOperation(
      model,
      changeCustomAttributesDefinition(
        model,
        emptyCustomAttributesDefinition(),
      ),
      labelManager,
    );

    expect(model.assets.get(IDS.J1)!.getProperty(key)).toBeNull();
    expect(getAttributes(model.customAttributes, "junction")).toEqual([]);
  });
});

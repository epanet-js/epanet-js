import { describe, it, expect } from "vitest";
import {
  customPropertyKey,
  emptyCustomAttributesDefinition,
  getAttributes,
  setAttributes,
} from "@epanet-js/custom-attributes";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildTestFactories } from "src/__helpers__/test-factories";
import { changeProperty } from "../model-operations/change-property";
import type { ChangeableProperty } from "../model-operations/change-property";
import { changeCustomAttributesDefinition } from "../model-operations/change-custom-attributes-definition";
import { applyMomentToModel } from "./apply-moment";

describe("applyMomentToModel with custom attributes definition", () => {
  it("applies the definition and restores it on reverse", () => {
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(1)
      .build();

    const next = setAttributes(emptyCustomAttributesDefinition(), "junction", [
      { id: "ca-1", label: "Zone", type: "text" },
    ]);
    const moment = changeCustomAttributesDefinition(model, next);

    const reverse = applyMomentToModel(model, moment, labelManager);

    expect(getAttributes(model.customAttributes, "junction")).toEqual([
      { id: "ca-1", label: "Zone", type: "text" },
    ]);

    applyMomentToModel(
      model,
      {
        note: reverse.note,
        putCustomAttributesDefinition: reverse.putCustomAttributesDefinition,
      },
      labelManager,
    );

    expect(getAttributes(model.customAttributes, "junction")).toEqual([]);
  });

  it("round-trips a custom-<id> value through undo then redo", () => {
    const IDS = { J1: 1 } as const;
    const key = customPropertyKey("ca-1") as ChangeableProperty;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aCustomAttribute("junction", { id: "ca-1", label: "Zone", type: "text" })
      .aJunction(IDS.J1)
      .build();

    const forward = changeProperty(model, {
      assetIds: [IDS.J1],
      property: key,
      value: "north" as never,
    });
    const reverse = applyMomentToModel(model, forward, labelManager);

    expect(model.assets.get(IDS.J1)!.getProperty(key)).toBe("north");

    const redo = applyMomentToModel(
      model,
      {
        note: reverse.note,
        patchAssetsAttributes: reverse.patchAssetsAttributes,
      },
      labelManager,
    );
    expect(model.assets.get(IDS.J1)!.getProperty(key)).toBeUndefined();

    applyMomentToModel(
      model,
      { note: redo.note, patchAssetsAttributes: redo.patchAssetsAttributes },
      labelManager,
    );
    expect(model.assets.get(IDS.J1)!.getProperty(key)).toBe("north");
  });

  it("clears custom values across assets when an attribute is removed", () => {
    const IDS = { J1: 1 } as const;
    const key = customPropertyKey("ca-1");
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aCustomAttribute("junction", { id: "ca-1", label: "Zone", type: "text" })
      .aJunction(IDS.J1)
      .build();
    model.assets.get(IDS.J1)!.setProperty(key, "north");

    const moment = changeCustomAttributesDefinition(
      model,
      emptyCustomAttributesDefinition(),
    );
    applyMomentToModel(model, moment, labelManager);

    expect(model.assets.get(IDS.J1)!.getProperty(key)).toBeNull();
    expect(getAttributes(model.customAttributes, "junction")).toEqual([]);
  });
});

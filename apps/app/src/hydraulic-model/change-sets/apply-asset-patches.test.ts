import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { applyOperation } from "src/__helpers__/apply-operation";
import { Pipe, Junction } from "@epanet-js/hydraulic-model";
import { ModelMoment } from "../model-operation";
import { buildTestFactories } from "src/__helpers__/test-factories";

describe("change sets from patchAssetsAttributes", () => {
  it("patches a single property on an asset", () => {
    const IDS = { PIPE: 1, N1: 2, N2: 3 } as const;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.N1)
      .aJunction(IDS.N2)
      .aPipe(IDS.PIPE, {
        startNodeId: IDS.N1,
        endNodeId: IDS.N2,
        diameter: 100,
      })
      .build();

    const moment: ModelMoment = {
      note: "Patch diameter",
      patchAssetsAttributes: [
        { id: IDS.PIPE, type: "pipe", properties: { diameter: 200 } },
      ],
    };

    const { undo } = applyOperation(model, moment, labelManager);
    expect((model.assets.get(IDS.PIPE) as Pipe).diameter).toBe(200);

    undo();
    expect((model.assets.get(IDS.PIPE) as Pipe).diameter).toBe(100);
  });

  it("patches multiple properties on one asset", () => {
    const IDS = { PIPE: 1, N1: 2, N2: 3 } as const;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.N1)
      .aJunction(IDS.N2)
      .aPipe(IDS.PIPE, {
        startNodeId: IDS.N1,
        endNodeId: IDS.N2,
        diameter: 100,
        roughness: 130,
      })
      .build();

    const moment: ModelMoment = {
      note: "Patch diameter and roughness",
      patchAssetsAttributes: [
        {
          id: IDS.PIPE,
          type: "pipe",
          properties: { diameter: 200, roughness: 150 },
        },
      ],
    };

    const { undo } = applyOperation(model, moment, labelManager);
    expect((model.assets.get(IDS.PIPE) as Pipe).diameter).toBe(200);
    expect((model.assets.get(IDS.PIPE) as Pipe).roughness).toBe(150);

    undo();
    expect((model.assets.get(IDS.PIPE) as Pipe).diameter).toBe(100);
    expect((model.assets.get(IDS.PIPE) as Pipe).roughness).toBe(130);
  });

  it("patches multiple assets", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { elevation: 10 })
      .aJunction(IDS.J2, { elevation: 20 })
      .build();

    const moment: ModelMoment = {
      note: "Patch elevations",
      patchAssetsAttributes: [
        { id: IDS.J1, type: "junction", properties: { elevation: 50 } },
        { id: IDS.J2, type: "junction", properties: { elevation: 60 } },
      ],
    };

    const { undo } = applyOperation(model, moment, labelManager);
    expect((model.assets.get(IDS.J1) as Junction).elevation).toBe(50);
    expect((model.assets.get(IDS.J2) as Junction).elevation).toBe(60);

    undo();
    expect((model.assets.get(IDS.J1) as Junction).elevation).toBe(10);
    expect((model.assets.get(IDS.J2) as Junction).elevation).toBe(20);
  });

  it("silently skips patches for non-existent assets", () => {
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(1, { elevation: 10 })
      .build();

    const moment: ModelMoment = {
      note: "Patch non-existent",
      patchAssetsAttributes: [
        { id: 999, type: "junction", properties: { elevation: 50 } },
      ],
    };

    const { changeSet } = applyOperation(model, moment, labelManager);

    expect(changeSet.isEmpty).toBe(true);
    expect(model.assets.has(999)).toBe(false);
    expect((model.assets.get(1) as Junction).elevation).toBe(10);
  });

  it("handles a moment with both putAssets and patchAssetsAttributes", () => {
    const IDS = { J1: 1, PIPE: 2, N1: 3, N2: 4 } as const;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { elevation: 10 })
      .aJunction(IDS.N1)
      .aJunction(IDS.N2)
      .aPipe(IDS.PIPE, {
        startNodeId: IDS.N1,
        endNodeId: IDS.N2,
        diameter: 100,
      })
      .build();

    const updatedJunction = (model.assets.get(IDS.J1) as Junction).copy();
    updatedJunction.setProperty("elevation", 99);

    const moment: ModelMoment = {
      note: "Mixed put and patch",
      putAssets: [updatedJunction],
      patchAssetsAttributes: [
        { id: IDS.PIPE, type: "pipe", properties: { diameter: 200 } },
      ],
    };

    const { undo } = applyOperation(model, moment, labelManager);
    expect((model.assets.get(IDS.J1) as Junction).elevation).toBe(99);
    expect((model.assets.get(IDS.PIPE) as Pipe).diameter).toBe(200);

    undo();
    expect((model.assets.get(IDS.J1) as Junction).elevation).toBe(10);
    expect((model.assets.get(IDS.PIPE) as Pipe).diameter).toBe(100);
  });

  it("updates labelManager when patching label", () => {
    const IDS = { J1: 1 } as const;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { elevation: 10 })
      .build();

    const oldLabel = (model.assets.get(IDS.J1) as Junction).label;

    const moment: ModelMoment = {
      note: "Rename junction",
      patchAssetsAttributes: [
        { id: IDS.J1, type: "junction", properties: { label: "NewName" } },
      ],
    };

    const { undo } = applyOperation(model, moment, labelManager);

    expect((model.assets.get(IDS.J1) as Junction).label).toBe("NewName");
    expect(labelManager.getIdByLabel("NewName", "junction")).toBe(IDS.J1);
    expect(labelManager.getIdByLabel(oldLabel, "junction")).toBeUndefined();

    undo();

    expect((model.assets.get(IDS.J1) as Junction).label).toBe(oldLabel);
    expect(labelManager.getIdByLabel(oldLabel, "junction")).toBe(IDS.J1);
    expect(labelManager.getIdByLabel("NewName", "junction")).toBeUndefined();
  });

  it("restores original values after multiple patches and reverses", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { elevation: 10 })
      .aJunction(IDS.J2, { elevation: 20 })
      .build();

    const first = applyOperation(
      model,
      {
        note: "Patch 1",
        patchAssetsAttributes: [
          { id: IDS.J1, type: "junction", properties: { elevation: 50 } },
        ],
      },
      labelManager,
    );
    const second = applyOperation(
      model,
      {
        note: "Patch 2",
        patchAssetsAttributes: [
          { id: IDS.J2, type: "junction", properties: { elevation: 60 } },
        ],
      },
      labelManager,
    );

    expect((model.assets.get(IDS.J1) as Junction).elevation).toBe(50);
    expect((model.assets.get(IDS.J2) as Junction).elevation).toBe(60);

    second.undo();
    expect((model.assets.get(IDS.J2) as Junction).elevation).toBe(20);
    expect((model.assets.get(IDS.J1) as Junction).elevation).toBe(50);

    first.undo();
    expect((model.assets.get(IDS.J1) as Junction).elevation).toBe(10);
    expect((model.assets.get(IDS.J2) as Junction).elevation).toBe(20);
  });
});

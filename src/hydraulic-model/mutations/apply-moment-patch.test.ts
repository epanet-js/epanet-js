import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { applyMomentToModel } from "./apply-moment";
import { Pipe, Junction } from "../asset-types";
import { ModelMoment } from "../model-operation";

describe("applyMomentToModel with patchAssetsAttributes", () => {
  it("patches a single property on an asset", () => {
    const IDS = { PIPE: 1, N1: 2, N2: 3 } as const;
    const model = HydraulicModelBuilder.with()
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

    const reverse = applyMomentToModel(model, moment);

    const updatedPipe = model.assets.get(IDS.PIPE) as Pipe;
    expect(updatedPipe.diameter).toBe(200);

    expect(reverse.patchAssetsAttributes).toHaveLength(1);
    expect(reverse.patchAssetsAttributes[0]).toEqual({
      id: IDS.PIPE,
      type: "pipe",
      properties: { diameter: 100 },
    });
  });

  it("patches multiple properties on one asset", () => {
    const IDS = { PIPE: 1, N1: 2, N2: 3 } as const;
    const model = HydraulicModelBuilder.with()
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

    const reverse = applyMomentToModel(model, moment);

    const updatedPipe = model.assets.get(IDS.PIPE) as Pipe;
    expect(updatedPipe.diameter).toBe(200);
    expect(updatedPipe.roughness).toBe(150);

    expect(reverse.patchAssetsAttributes).toHaveLength(1);
    expect(reverse.patchAssetsAttributes[0]).toEqual({
      id: IDS.PIPE,
      type: "pipe",
      properties: { diameter: 100, roughness: 130 },
    });
  });

  it("patches multiple assets", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const model = HydraulicModelBuilder.with()
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

    const reverse = applyMomentToModel(model, moment);

    expect((model.assets.get(IDS.J1) as Junction).elevation).toBe(50);
    expect((model.assets.get(IDS.J2) as Junction).elevation).toBe(60);

    expect(reverse.patchAssetsAttributes).toHaveLength(2);
    expect(reverse.patchAssetsAttributes[0]).toEqual({
      id: IDS.J1,
      type: "junction",
      properties: { elevation: 10 },
    });
    expect(reverse.patchAssetsAttributes[1]).toEqual({
      id: IDS.J2,
      type: "junction",
      properties: { elevation: 20 },
    });
  });

  it("silently skips patches for non-existent assets", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { elevation: 10 })
      .build();

    const moment: ModelMoment = {
      note: "Patch non-existent",
      patchAssetsAttributes: [
        { id: 999, type: "junction", properties: { elevation: 50 } },
      ],
    };

    const reverse = applyMomentToModel(model, moment);

    expect(reverse.patchAssetsAttributes).toHaveLength(0);
    expect((model.assets.get(1) as Junction).elevation).toBe(10);
  });

  it("handles a moment with both putAssets and patchAssetsAttributes", () => {
    const IDS = { J1: 1, PIPE: 2, N1: 3, N2: 4 } as const;
    const model = HydraulicModelBuilder.with()
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

    const reverse = applyMomentToModel(model, moment);

    expect((model.assets.get(IDS.J1) as Junction).elevation).toBe(99);
    expect((model.assets.get(IDS.PIPE) as Pipe).diameter).toBe(200);

    expect(reverse.putAssets).toHaveLength(1);
    expect((reverse.putAssets[0] as Junction).elevation).toBe(10);

    expect(reverse.patchAssetsAttributes).toHaveLength(1);
    expect(reverse.patchAssetsAttributes[0]).toEqual({
      id: IDS.PIPE,
      type: "pipe",
      properties: { diameter: 100 },
    });
  });

  it("updates labelManager when patching label", () => {
    const IDS = { J1: 1 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { elevation: 10 })
      .build();

    const oldLabel = (model.assets.get(IDS.J1) as Junction).label;

    const moment: ModelMoment = {
      note: "Rename junction",
      patchAssetsAttributes: [
        { id: IDS.J1, type: "junction", properties: { label: "NewName" } },
      ],
    };

    const reverse = applyMomentToModel(model, moment);

    expect((model.assets.get(IDS.J1) as Junction).label).toBe("NewName");
    expect(model.labelManager.getIdByLabel("NewName", "junction")).toBe(IDS.J1);
    expect(
      model.labelManager.getIdByLabel(oldLabel, "junction"),
    ).toBeUndefined();

    // Undo restores old label in labelManager
    applyMomentToModel(model, {
      note: reverse.note,
      patchAssetsAttributes: reverse.patchAssetsAttributes,
    });

    expect((model.assets.get(IDS.J1) as Junction).label).toBe(oldLabel);
    expect(model.labelManager.getIdByLabel(oldLabel, "junction")).toBe(IDS.J1);
    expect(
      model.labelManager.getIdByLabel("NewName", "junction"),
    ).toBeUndefined();
  });

  it("restores original values when applying the reverse patch", () => {
    const IDS = { PIPE: 1, N1: 2, N2: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.N1)
      .aJunction(IDS.N2)
      .aPipe(IDS.PIPE, {
        startNodeId: IDS.N1,
        endNodeId: IDS.N2,
        diameter: 100,
        roughness: 130,
      })
      .build();

    const forwardMoment: ModelMoment = {
      note: "Change diameter",
      patchAssetsAttributes: [
        {
          id: IDS.PIPE,
          type: "pipe",
          properties: { diameter: 200, roughness: 150 },
        },
      ],
    };

    const reverse = applyMomentToModel(model, forwardMoment);

    expect((model.assets.get(IDS.PIPE) as Pipe).diameter).toBe(200);
    expect((model.assets.get(IDS.PIPE) as Pipe).roughness).toBe(150);

    const reverseMoment: ModelMoment = {
      note: reverse.note,
      patchAssetsAttributes: reverse.patchAssetsAttributes,
    };
    applyMomentToModel(model, reverseMoment);

    expect((model.assets.get(IDS.PIPE) as Pipe).diameter).toBe(100);
    expect((model.assets.get(IDS.PIPE) as Pipe).roughness).toBe(130);
  });

  it("restores original values after multiple patches and reverses", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { elevation: 10 })
      .aJunction(IDS.J2, { elevation: 20 })
      .build();

    const moment1: ModelMoment = {
      note: "Patch 1",
      patchAssetsAttributes: [
        { id: IDS.J1, type: "junction", properties: { elevation: 50 } },
      ],
    };
    const reverse1 = applyMomentToModel(model, moment1);

    const moment2: ModelMoment = {
      note: "Patch 2",
      patchAssetsAttributes: [
        { id: IDS.J2, type: "junction", properties: { elevation: 60 } },
      ],
    };
    const reverse2 = applyMomentToModel(model, moment2);

    expect((model.assets.get(IDS.J1) as Junction).elevation).toBe(50);
    expect((model.assets.get(IDS.J2) as Junction).elevation).toBe(60);

    // Undo patch 2
    applyMomentToModel(model, {
      note: reverse2.note,
      patchAssetsAttributes: reverse2.patchAssetsAttributes,
    });
    expect((model.assets.get(IDS.J2) as Junction).elevation).toBe(20);
    expect((model.assets.get(IDS.J1) as Junction).elevation).toBe(50);

    // Undo patch 1
    applyMomentToModel(model, {
      note: reverse1.note,
      patchAssetsAttributes: reverse1.patchAssetsAttributes,
    });
    expect((model.assets.get(IDS.J1) as Junction).elevation).toBe(10);
    expect((model.assets.get(IDS.J2) as Junction).elevation).toBe(20);
  });
});

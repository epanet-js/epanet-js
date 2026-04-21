import { presets } from "src/lib/project-settings/quantities-spec";
import { ConsecutiveIdsGenerator } from "src/lib/id-generator";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { initializeModelFactories } from "src/hydraulic-model/factories";
import { initializeHydraulicModel } from "src/hydraulic-model";
import type { HydraulicModel } from "src/hydraulic-model";
import type { ModelMoment } from "src/hydraulic-model/model-operation";
import { buildMomentPayload } from "./apply-moment";

const setupModel = (): {
  model: HydraulicModel;
  factories: ReturnType<typeof initializeModelFactories>;
} => {
  const idGenerator = new ConsecutiveIdsGenerator();
  const labelManager = new LabelManager();
  const factories = initializeModelFactories({
    idGenerator,
    labelManager,
    defaults: presets.LPS.defaults,
  });
  const model = initializeHydraulicModel({ idGenerator });
  return { model, factories };
};

describe("buildMomentPayload", () => {
  it("returns empty payload for an empty moment", () => {
    const { model } = setupModel();

    const payload = buildMomentPayload({ note: "noop" }, model);

    expect(payload.deleteIds).toEqual([]);
    expect(payload.upserts.junctions).toEqual([]);
    expect(payload.upserts.pipes).toEqual([]);
  });

  it("collects putAssets into upserts bucketed by type", () => {
    const { model, factories } = setupModel();
    const junction = factories.assetFactory.createJunction({
      id: 1,
      label: "J1",
      coordinates: [0, 0],
    });
    const pipe = factories.assetFactory.createPipe({
      id: 2,
      label: "P1",
      connections: [1, 1],
      coordinates: [
        [0, 0],
        [1, 0],
      ],
    });
    model.assets.set(junction.id, junction);
    model.assets.set(pipe.id, pipe);

    const moment: ModelMoment = {
      note: "add",
      putAssets: [junction, pipe],
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.upserts.junctions).toHaveLength(1);
    expect(payload.upserts.junctions[0].id).toBe(1);
    expect(payload.upserts.pipes).toHaveLength(1);
    expect(payload.upserts.pipes[0].id).toBe(2);
  });

  it("refetches patched assets from the post-apply model for full-row upsert", () => {
    const { model, factories } = setupModel();
    const junction = factories.assetFactory.createJunction({
      id: 1,
      label: "J1",
      coordinates: [0, 0],
      elevation: 42,
    });
    model.assets.set(junction.id, junction);

    const moment: ModelMoment = {
      note: "edit",
      patchAssetsAttributes: [
        {
          id: 1,
          type: "junction",
          properties: { elevation: 100 },
        },
      ],
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.upserts.junctions).toHaveLength(1);
    expect(payload.upserts.junctions[0].id).toBe(1);
    expect(payload.upserts.junctions[0].elevation).toBe(42);
  });

  it("deduplicates an asset that appears in both putAssets and patchAssetsAttributes", () => {
    const { model, factories } = setupModel();
    const junction = factories.assetFactory.createJunction({
      id: 1,
      label: "J1",
    });
    model.assets.set(junction.id, junction);

    const moment: ModelMoment = {
      note: "dup",
      putAssets: [junction],
      patchAssetsAttributes: [
        {
          id: 1,
          type: "junction",
          properties: { elevation: 10 },
        },
      ],
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.upserts.junctions).toHaveLength(1);
  });

  it("forwards deleteAssets ids", () => {
    const { model } = setupModel();

    const moment: ModelMoment = {
      note: "del",
      deleteAssets: [3, 7, 11],
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.deleteIds).toEqual([3, 7, 11]);
  });

  it("skips assets that were deleted and are not in the post-apply model", () => {
    const { model, factories } = setupModel();
    const junction = factories.assetFactory.createJunction({
      id: 1,
      label: "J1",
    });

    const moment: ModelMoment = {
      note: "patch on deleted",
      patchAssetsAttributes: [
        {
          id: junction.id,
          type: "junction",
          properties: { elevation: 99 },
        },
      ],
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.upserts.junctions).toEqual([]);
  });
});

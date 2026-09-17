import { describe, expect, it } from "vitest";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { type Junction, type Pipe } from "@epanet-js/hydraulic-model";
import type { HydraulicModel } from "src/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildTestFactories } from "src/__helpers__/test-factories";
import { changeSet } from "src/hydraulic-model/change-sets/build";
import {
  dropAssets,
  putAssets,
  replaceCurves,
  setAsset,
  setDemands,
} from "src/hydraulic-model/change-sets/intents";
import { applyChangeSetToDb } from "./apply-change-set";
import { fetchProject } from "./fetch-project";
import { importProject } from "./import-project";
import { useInProcessDb } from "../__test-helpers__/in-process-db";
import { getWorker } from "@epanet-js/ejsdb";
import { buildIdPoolsData } from "@epanet-js/ejsdb-mappers";
import type { IdPoolSeeds } from "@epanet-js/id-generator";

const storedIdPools = async () =>
  buildIdPoolsData(await getWorker().getIdPools());

const somePools: IdPoolSeeds = {
  asset: 10,
  customerPoint: 20,
  pattern: 30,
  curve: 40,
  zone: 50,
};

const seed = (hydraulicModel: HydraulicModel) =>
  importProject({
    idPools: null,
    newDb: true,
    hydraulicModel,
    projectSettings: defaultProjectSettings,
    simulationSettings: defaultSimulationSettings,
  });

const IDS = { J1: 1, J2: 2, P1: 3, C1: 4, J3: 5 } as const;

const aNetwork = () => {
  const { labelManager, assetFactory } = buildTestFactories();
  const model = HydraulicModelBuilder.with({ labelManager })
    .aJunction(IDS.J1, { coordinates: [0, 0], elevation: 10 })
    .aJunction(IDS.J2, { coordinates: [10, 0], elevation: 20 })
    .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2, diameter: 200 })
    .aCurve({
      id: IDS.C1,
      label: "C1",
      type: "volume",
      points: [{ x: 1, y: 1 }],
    })
    .build();

  return { model, assetFactory };
};

describe("apply-change-set integration", () => {
  useInProcessDb();

  it("writes a create, an update and a delete from one change set", async () => {
    const { model, assetFactory } = aNetwork();
    await seed(model);

    const junction = assetFactory.createJunction({
      id: IDS.J3,
      coordinates: [20, 5],
      elevation: 30,
    });

    await applyChangeSetToDb(
      changeSet(model, "edit", [
        putAssets([junction]),
        setAsset(IDS.P1, { diameter: 300 }),
        dropAssets([IDS.J2]),
      ]),
      "forward",
      null,
    );

    const { hydraulicModel } = await fetchProject();

    expect((hydraulicModel.assets.get(IDS.J3) as Junction).coordinates).toEqual(
      [20, 5],
    );
    expect((hydraulicModel.assets.get(IDS.P1) as Pipe).diameter).toBe(300);
    expect(hydraulicModel.assets.has(IDS.J2)).toBe(false);
  });

  it("undoes a change set by writing it in reverse", async () => {
    const { model } = aNetwork();
    await seed(model);

    const built = changeSet(model, "changeProperty", [
      setAsset(IDS.P1, { diameter: 300 }),
    ]);

    await applyChangeSetToDb(built, "forward", null);
    await applyChangeSetToDb(built, "reverse", null);

    const { hydraulicModel } = await fetchProject();

    expect((hydraulicModel.assets.get(IDS.P1) as Pipe).diameter).toBe(200);
  });

  it("writes curves and demands from one change set", async () => {
    const { model } = aNetwork();
    await seed(model);

    const curves = new Map(model.curves);
    curves.set(IDS.C1, { ...curves.get(IDS.C1)!, points: [{ x: 5, y: 6 }] });

    await applyChangeSetToDb(
      changeSet(model, "edit", [
        replaceCurves(curves),
        setDemands([{ junctionId: IDS.J1, demands: [{ baseDemand: 7 }] }]),
      ]),
      "forward",
      null,
    );

    const { hydraulicModel } = await fetchProject();

    expect(hydraulicModel.curves.get(IDS.C1)!.points).toEqual([{ x: 5, y: 6 }]);
    expect(hydraulicModel.demands.junctions.get(IDS.J1)).toEqual([
      { baseDemand: 7 },
    ]);
  });

  describe("id pools", () => {
    const aDiameterEdit = (model: HydraulicModel) =>
      changeSet(model, "changeProperty", [setAsset(IDS.P1, { diameter: 300 })]);

    it("stores the pools with the change set", async () => {
      const { model } = aNetwork();
      await seed(model);

      await applyChangeSetToDb(aDiameterEdit(model), "forward", somePools);

      expect(await storedIdPools()).toEqual(somePools);
    });

    it("replaces the stored pools with a later snapshot", async () => {
      const { model } = aNetwork();
      await seed(model);
      const built = aDiameterEdit(model);
      const later = { ...somePools, asset: 11, zone: 99 };

      await applyChangeSetToDb(built, "forward", somePools);
      await applyChangeSetToDb(built, "reverse", later);

      expect(await storedIdPools()).toEqual(later);
    });

    it("leaves the stored pools untouched without a snapshot", async () => {
      const { model } = aNetwork();
      await seed(model);

      await applyChangeSetToDb(aDiameterEdit(model), "forward", null);

      expect(await storedIdPools()).toBeNull();
    });

    it("rolls back the change set when the pools cannot be stored", async () => {
      const { model } = aNetwork();
      await seed(model);

      await expect(
        getWorker().applyChangeSet(
          aDiameterEdit(model).bytes,
          "forward",
          JSON.stringify({ asset: -1 }),
        ),
      ).rejects.toThrow(/Id pools: data does not match schema/);

      const { hydraulicModel } = await fetchProject();
      expect((hydraulicModel.assets.get(IDS.P1) as Pipe).diameter).toBe(200);
    });
  });
});

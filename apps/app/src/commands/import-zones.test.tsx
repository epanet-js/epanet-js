import { act, renderHook } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import type { BuildZonesResult } from "@epanet-js/converters";
import type { Zone, Zones } from "@epanet-js/hydraulic-model";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import * as db from "src/lib/db";
import { writeQueue } from "src/lib/persistence/write-queue";
import { useUndoableTransactions } from "src/hooks/persistence/use-undoable-transactions";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import {
  isZonesInModelOnAtom,
  zonesAtom,
  zonesDeprecatedAtom,
} from "src/state/zones";
import type { Store } from "src/state";
import { useImportZones } from "./import-zones";

const aZone = (id: number, label: string): Zone => ({
  id,
  label,
  geometry: {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    ],
  },
  bbox: [0, 0, 1, 1],
});

const built = (...zones: Zone[]): BuildZonesResult => ({
  zones: new Map(zones.map((zone) => [zone.id, zone])) as Zones,
  mergedZones: [],
});

const withStore = (store: Store) => ({
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <JotaiProvider store={store}>{children}</JotaiProvider>
  ),
});

const aProject = async (isZonesInModelOn: boolean): Promise<Store> => {
  const hydraulicModel = HydraulicModelBuilder.with()
    .aJunction(1, { coordinates: [0, 0] })
    .build();
  const store = setInitialState({ hydraulicModel });
  store.set(isZonesInModelOnAtom, isZonesInModelOn);
  await db.importProject({
    newDb: true,
    hydraulicModel,
    projectSettings: defaultProjectSettings,
    simulationSettings: defaultSimulationSettings,
  });
  return store;
};

const importZones = async (store: Store, result: BuildZonesResult) => {
  const { result: hook } = renderHook(() => useImportZones(), withStore(store));
  let imported: BuildZonesResult | null = null;
  await act(async () => {
    imported = await hook.current(result);
    await writeQueue.whenIdle();
  });
  return imported;
};

const zoneLabels = (zones: Zones) =>
  [...zones.values()].map((zone) => zone.label);

describe("useImportZones", () => {
  useInProcessDb();

  describe("with FLAG_ZONES_IN_MODEL on", () => {
    beforeEach(() => {
      stubFeatureOn("FLAG_ZONES_IN_MODEL");
    });

    it("puts the imported zones in the model", async () => {
      const store = await aProject(true);

      const imported = await importZones(
        store,
        built(aZone(1, "NORTH"), aZone(2, "SOUTH")),
      );

      expect(imported).not.toBeNull();
      expect(zoneLabels(store.get(stagingModelDerivedAtom).zones)).toEqual([
        "NORTH",
        "SOUTH",
      ]);
      expect(zoneLabels(store.get(zonesAtom))).toEqual(["NORTH", "SOUTH"]);
      expect(store.get(zonesDeprecatedAtom).size).toBe(0);
    });

    it("persists the imported zones", async () => {
      const store = await aProject(true);

      await importZones(store, built(aZone(1, "NORTH")));

      const { hydraulicModel } = await db.fetchProject();
      expect(hydraulicModel.zones.get(1)).toEqual(aZone(1, "NORTH"));
    });

    it("replaces the zones of a previous import", async () => {
      const store = await aProject(true);
      await importZones(store, built(aZone(1, "NORTH"), aZone(2, "SOUTH")));

      await importZones(store, built(aZone(3, "EAST")));

      expect(zoneLabels(store.get(zonesAtom))).toEqual(["EAST"]);
      const { hydraulicModel } = await db.fetchProject();
      expect(zoneLabels(hydraulicModel.zones)).toEqual(["EAST"]);
    });

    it("undoes an import", async () => {
      const store = await aProject(true);
      await importZones(store, built(aZone(1, "NORTH")));

      const { result } = renderHook(
        () => useUndoableTransactions(),
        withStore(store),
      );
      await act(async () => {
        result.current.historyControl("undo");
        await writeQueue.whenIdle();
      });

      expect(store.get(zonesAtom).size).toBe(0);
      const { hydraulicModel } = await db.fetchProject();
      expect(hydraulicModel.zones.size).toBe(0);
    });
  });

  describe("with FLAG_ZONES_IN_MODEL off", () => {
    beforeEach(() => {
      stubFeatureOff("FLAG_ZONES_IN_MODEL");
    });

    it("keeps the imported zones outside the model", async () => {
      const store = await aProject(false);

      await importZones(store, built(aZone(1, "NORTH")));

      expect(zoneLabels(store.get(zonesDeprecatedAtom))).toEqual(["NORTH"]);
      expect(zoneLabels(store.get(zonesAtom))).toEqual(["NORTH"]);
      expect(store.get(stagingModelDerivedAtom).zones.size).toBe(0);
    });
  });
});

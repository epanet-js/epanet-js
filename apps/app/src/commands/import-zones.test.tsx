import { act, renderHook } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import type { BuildZonesResult } from "@epanet-js/converters";
import {
  getAttributes,
  setAttributes,
  type CustomAttributesDefinition,
  type Zone,
  type Zones,
} from "@epanet-js/hydraulic-model";
import {
  HydraulicModelBuilder,
  buildZone,
} from "@epanet-js/hydraulic-model-testing";
import { setInitialState } from "src/__helpers__/state";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import * as db from "src/lib/db";
import { writeQueue } from "src/lib/persistence/write-queue";
import { useUndoableTransactions } from "src/hooks/persistence/use-undoable-transactions";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { zonesAtom } from "src/state/zones";
import type { Store } from "src/state";
import { useImportZones } from "./import-zones";

const aZone = (
  id: number,
  label: string,
  customAttributes: Record<string, string | number> = {},
): Zone =>
  buildZone({
    id,
    label,
    customAttributes,
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
  renamedZones: [],
});

const withStore = (store: Store) => ({
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <JotaiProvider store={store}>{children}</JotaiProvider>
  ),
});

const aProject = async (): Promise<Store> => {
  const hydraulicModel = HydraulicModelBuilder.with()
    .aJunction(1, { coordinates: [0, 0] })
    .build();
  const store = setInitialState({ hydraulicModel });
  await db.importProject({
    newDb: true,
    hydraulicModel,
    projectSettings: defaultProjectSettings,
    simulationSettings: defaultSimulationSettings,
  });
  return store;
};

const importZones = async (
  store: Store,
  result: BuildZonesResult,
  customAttributes?: CustomAttributesDefinition,
) => {
  const { result: hook } = renderHook(() => useImportZones(), withStore(store));
  let imported: BuildZonesResult | null = null;
  await act(async () => {
    imported = await hook.current(result, customAttributes);
    await writeQueue.whenIdle();
  });
  return imported;
};

const zoneLabels = (zones: Zones) =>
  [...zones.values()].map((zone) => zone.label);

describe("useImportZones", () => {
  useInProcessDb();

  it("puts the imported zones in the model", async () => {
    const store = await aProject();

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
  });

  it("persists the imported zones", async () => {
    const store = await aProject();

    await importZones(store, built(aZone(1, "NORTH")));

    const { hydraulicModel } = await db.fetchProject();
    expect(hydraulicModel.zones.get(1)).toEqual(aZone(1, "NORTH"));
  });

  it("replaces the zones of a previous import", async () => {
    const store = await aProject();
    await importZones(store, built(aZone(1, "NORTH"), aZone(2, "SOUTH")));

    await importZones(store, built(aZone(3, "EAST")));

    expect(zoneLabels(store.get(zonesAtom))).toEqual(["EAST"]);
    const { hydraulicModel } = await db.fetchProject();
    expect(zoneLabels(hydraulicModel.zones)).toEqual(["EAST"]);
  });

  it("adds the imported attribute definitions with the zones", async () => {
    const store = await aProject();
    const definition = setAttributes(
      store.get(stagingModelDerivedAtom).customAttributes,
      "zone",
      [{ id: "custom-1", label: "Area", type: "text" }],
    );

    await importZones(
      store,
      built(aZone(1, "NORTH", { "custom-1": "LOW" })),
      definition,
    );

    const { hydraulicModel } = await db.fetchProject();
    expect(getAttributes(hydraulicModel.customAttributes, "zone")).toEqual([
      { id: "custom-1", label: "Area", type: "text" },
    ]);
    expect(hydraulicModel.zones.get(1)!.getProperty("custom-1")).toBe("LOW");
  });

  it("undoes an import", async () => {
    const store = await aProject();
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

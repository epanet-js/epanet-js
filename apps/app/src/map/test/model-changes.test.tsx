import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { getAssetsByType } from "src/__helpers__/asset-queries";
import { addNode } from "src/hydraulic-model/model-operations/add-node";
import { changeProperty } from "src/hydraulic-model/model-operations/change-property";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useUndoableTransactions } from "src/hooks/persistence/use-undoable-transactions";
import { modelFactoriesAtom } from "src/state/model-factories";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import type { HydraulicModel } from "src/hydraulic-model";
import { Store } from "src/state";
import { AssetId, Junction } from "@epanet-js/hydraulic-model";
import {
  getFeatureState,
  getSourceFeatures,
} from "./__helpers__/map-engine-mock";
import { matchPoint, renderMap } from "./__helpers__/map";
import type { MapTestEngine } from "./__helpers__/map-engine-mock";

const FIRST = [1, 2];
const SECOND = [10, 20];
const MAX_CHANGES_BEFORE_MAP_SYNC = 500;

describe("model changes reach the map", () => {
  it("renders an added junction", async () => {
    const { store, map } = await renderWarmMap();

    addJunction(store, SECOND);

    await expectRendered(map, SECOND);
  });

  it("moves an edited asset into editions and hides it in the snapshot", async () => {
    const { store, map } = await renderWarmMap();
    const junctionId = junctionIds(store)[0];

    changeElevation(store, [junctionId]);

    await waitFor(() => {
      expect(getSourceFeatures(map, "delta-features")).toHaveLength(1);
      expect(getFeatureState(map, "main-features", junctionId).hidden).toBe(
        true,
      );
    });
  });

  it("consolidates once the editions budget is exceeded", async () => {
    const { store, map } = await renderWarmMap(
      aModelWithJunctions(MAX_CHANGES_BEFORE_MAP_SYNC + 1),
    );
    const snapshotBefore = getSourceFeatures(map, "main-features");

    changeElevation(store, junctionIds(store));

    // The snapshot is only re-encoded on a consolidation; the editions path leaves it
    // untouched, so a new array is the signal that the budget forced one.
    await waitFor(() => {
      expect(getSourceFeatures(map, "main-features")).not.toBe(snapshotBefore);
    });
    expect(getSourceFeatures(map, "delta-features")).toHaveLength(0);
    expect(getSourceFeatures(map, "main-features").length).toBeGreaterThan(
      MAX_CHANGES_BEFORE_MAP_SYNC,
    );
  });

  it("drops the junction again on undo", async () => {
    const { store, map } = await renderWarmMap();
    addJunction(store, SECOND);
    await expectRendered(map, SECOND);

    undo(store);

    await waitFor(() => {
      expect(junctionIds(store)).toHaveLength(1);
      expect(getSourceFeatures(map, "delta-features")).not.toContainEqual(
        matchPoint({ coordinates: SECOND }),
      );
    });
  });
});

// The first apply coalesces with the initial style sync, so the map can consolidate it
// into main rather than editions. Landing one edit first leaves the updater committed and
// idle, so the edit under test is the only thing driving the next cycle.
const renderWarmMap = async (
  hydraulicModel: HydraulicModel = HydraulicModelBuilder.with().build(),
) => {
  const store = setInitialState({ hydraulicModel });
  const map = await renderMap(store);

  addJunction(store, FIRST);
  await expectRendered(map, FIRST);

  return { store, map };
};

const aModelWithJunctions = (count: number): HydraulicModel => {
  let builder = HydraulicModelBuilder.with();
  for (let index = 1; index <= count; index++) {
    builder = builder.aJunction(index, { coordinates: [index, index] });
  }
  return builder.build();
};

const expectRendered = async (map: MapTestEngine, coordinates: number[]) => {
  await waitFor(() => {
    expect(networkFeatures(map)).toContainEqual(matchPoint({ coordinates }));
  });
};

const junctionIds = (store: Store): AssetId[] => {
  const { assets } = store.get(stagingModelDerivedAtom);
  return getAssetsByType<Junction>(assets, "junction").map(
    (junction) => junction.id,
  );
};

const withStore = (store: Store) => ({
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <JotaiProvider store={store}>{children}</JotaiProvider>
  ),
});

const addJunction = (store: Store, coordinates: number[]) => {
  const { result } = renderHook(() => useMomentTransaction(), withStore(store));
  const factories = store.get(modelFactoriesAtom);
  const moment = addNode(store.get(stagingModelDerivedAtom), {
    nodeType: "junction",
    coordinates,
    elevation: 5,
    lengthUnit: "m",
    assetFactory: factories.assetFactory,
    labelManager: factories.labelManager,
  });

  act(() => {
    result.current.transact(moment);
  });
};

const changeElevation = (store: Store, assetIds: AssetId[]) => {
  const { result } = renderHook(() => useMomentTransaction(), withStore(store));
  const moment = changeProperty(store.get(stagingModelDerivedAtom), {
    assetIds,
    property: "elevation",
    value: 42,
  });

  act(() => {
    result.current.transact(moment);
  });
};

const undo = (store: Store) => {
  const { result } = renderHook(
    () => useUndoableTransactions(),
    withStore(store),
  );

  act(() => {
    void result.current.historyControl("undo");
  });
};

const networkFeatures = (map: MapTestEngine): GeoJSON.Feature[] => [
  ...getSourceFeatures(map, "main-features"),
  ...getSourceFeatures(map, "delta-features"),
];

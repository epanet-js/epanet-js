import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { getAssetsByType } from "src/__helpers__/asset-queries";
import { addNode } from "src/hydraulic-model/model-operations/add-node";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useUndoableTransactions } from "src/hooks/persistence/use-undoable-transactions";
import { modelFactoriesAtom } from "src/state/model-factories";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { Store } from "src/state";
import { Junction } from "@epanet-js/hydraulic-model";
import { getSourceFeatures } from "./__helpers__/map-engine-mock";
import { matchPoint, renderMap } from "./__helpers__/map";
import type { MapTestEngine } from "./__helpers__/map-engine-mock";

const FIRST = [1, 2];
const SECOND = [10, 20];

describe.each([
  { flagState: "enabled", enabledFlags: ["FLAG_CHANGE_TRACKER"] },
  { flagState: "disabled", enabledFlags: [] },
])(
  "model changes reach the map — FLAG_CHANGE_TRACKER $flagState",
  ({ enabledFlags }) => {
    it("renders an added junction", async () => {
      const { store, map } = await renderWarmMap(enabledFlags);

      addJunction(store, SECOND);

      await expectRendered(map, SECOND);
    });

    it("drops the junction again on undo", async () => {
      const { store, map } = await renderWarmMap(enabledFlags);
      addJunction(store, SECOND);
      await expectRendered(map, SECOND);

      undo(store);

      await waitFor(() => {
        const { assets } = store.get(stagingModelDerivedAtom);
        expect(getAssetsByType<Junction>(assets, "junction")).toHaveLength(1);
        expect(getSourceFeatures(map, "delta-features")).not.toContainEqual(
          matchPoint({ coordinates: SECOND }),
        );
      });
    });
  },
);

// The first apply coalesces with the initial style sync, so the map can consolidate it
// into main rather than editions. Landing one edit first leaves the updater committed and
// idle, so the edit under test is the only thing driving the next cycle.
const renderWarmMap = async (enabledFlags: string[]) => {
  const store = setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().build(),
  });
  const map = await renderMap(store, enabledFlags);

  addJunction(store, FIRST);
  await expectRendered(map, FIRST);

  return { store, map };
};

const expectRendered = async (map: MapTestEngine, coordinates: number[]) => {
  await waitFor(() => {
    expect(networkFeatures(map)).toContainEqual(matchPoint({ coordinates }));
  });
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

const undo = (store: Store) => {
  const { result } = renderHook(
    () => useUndoableTransactions(),
    withStore(store),
  );

  act(() => {
    result.current.historyControl("undo");
  });
};

const networkFeatures = (map: MapTestEngine): GeoJSON.Feature[] => [
  ...getSourceFeatures(map, "main-features"),
  ...getSourceFeatures(map, "delta-features"),
];

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Provider as JotaiProvider } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  emptyCustomAttributesDefinition,
  getValue,
  setAttributes,
} from "@epanet-js/custom-attributes";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { Persistence } from "src/lib/persistence/persistence";
import { PersistenceContext } from "src/lib/persistence/context";
import { saveCustomAttributesData } from "src/lib/db";
import {
  customAttributesDataAtom,
  customAttributesDefinitionAtom,
} from "src/state/custom-attributes";
import {
  stagingModelDerivedAtom,
  momentLogDerivedAtom,
} from "src/state/derived-branch-state";
import { mapSyncMomentAtom } from "src/state/map";
import {
  applyMoment,
  computeSyncMoment,
} from "src/lib/persistence/transaction-helpers";
import { Store } from "src/state";
import { USelection } from "src/selection";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { useCustomAttributesDefinitionTransaction } from "src/hooks/persistence/use-custom-attributes-definition-transaction";
import { changeCustomAttributes } from "./change-custom-attribute";

vi.mock("src/lib/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("src/lib/db")>()),
  applyMomentToDb: vi.fn().mockResolvedValue(undefined),
  saveCustomAttributes: vi.fn().mockResolvedValue(undefined),
  saveCustomAttributesData: vi.fn().mockResolvedValue(undefined),
}));

const IDS = { J1: 1 };

const undo = (store: Store) => {
  const momentLog = store.get(momentLogDerivedAtom).copy();
  const mapSyncMoment = store.get(mapSyncMomentAtom);
  const action = momentLog.nextUndo();
  if (!action) return;
  applyMoment(
    store.get,
    store.set,
    action.stateId,
    action.moment,
    stagingModelDerivedAtom,
  );
  momentLog.undo();
  store.set(momentLogDerivedAtom, momentLog);
  store.set(mapSyncMomentAtom, computeSyncMoment(mapSyncMoment, momentLog));
};

const createWrapper = (store: Store) => {
  const persistence = new Persistence(store);
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>
      <JotaiProvider store={store}>
        <PersistenceContext.Provider value={persistence}>
          {children}
        </PersistenceContext.Provider>
      </JotaiProvider>
    </QueryClientProvider>
  );
};

const buildStore = (): Store => {
  const store = setInitialState({
    hydraulicModel: HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { label: "J1" })
      .build(),
    selection: USelection.fromAssetIds([IDS.J1]),
  });
  store.set(
    customAttributesDefinitionAtom,
    setAttributes(emptyCustomAttributesDefinition(), "junction", [
      { id: "ca-1", label: "Age", type: "number" },
    ]),
  );
  return store;
};

describe("custom attribute removal", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_CUSTOM_ATTRIBUTES");
  });

  it("prunes data on removal and makes undo of the value edit a no-op", async () => {
    const store = buildStore();
    const { result } = renderHook(
      () => ({
        model: useModelTransaction(),
        definition: useCustomAttributesDefinitionTransaction(),
      }),
      { wrapper: createWrapper(store) },
    );

    act(() => {
      result.current.model.transact(
        changeCustomAttributes(
          {
            definition: store.get(customAttributesDefinitionAtom),
            data: store.get(customAttributesDataAtom),
          },
          [{ assetId: IDS.J1, attributeId: "ca-1", value: 42 }],
        ),
      );
    });
    expect(
      getValue(store.get(customAttributesDataAtom), IDS.J1, "ca-1"),
    ).toEqual(42);

    await act(async () => {
      await result.current.definition.transact(
        emptyCustomAttributesDefinition(),
      );
    });
    expect(
      getValue(store.get(customAttributesDataAtom), IDS.J1, "ca-1"),
    ).toBeNull();

    expect(saveCustomAttributesData).toHaveBeenCalledWith(
      store.get(customAttributesDataAtom),
      new Set([IDS.J1]),
    );

    act(() => undo(store));
    expect(
      getValue(store.get(customAttributesDataAtom), IDS.J1, "ca-1"),
    ).toBeNull();
  });
});

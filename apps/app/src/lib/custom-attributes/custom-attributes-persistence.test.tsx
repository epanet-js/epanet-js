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
import { applyMomentToDb } from "src/lib/db";
import { dialogAtom } from "src/state/dialog";
import {
  customAttributesDataAtom,
  customAttributesDefinitionAtom,
} from "src/state/custom-attributes";
import { Store } from "src/state";
import { USelection } from "src/selection";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { useUndoableTransactions } from "src/hooks/persistence/use-undoable-transactions";
import { changeCustomAttributes } from "./change-custom-attribute";

vi.mock("src/lib/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("src/lib/db")>()),
  applyMomentToDb: vi.fn().mockResolvedValue(undefined),
}));

const IDS = { J1: 1 };

const modelOf = (store: Store) => ({
  definition: store.get(customAttributesDefinitionAtom),
  data: store.get(customAttributesDataAtom),
});

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

describe("custom attribute value persistence", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_CUSTOM_ATTRIBUTES");
    vi.mocked(applyMomentToDb).mockClear();
  });

  it("persists the affected asset's values in the moment payload on a value edit", () => {
    const store = buildStore();
    const { result } = renderHook(() => useModelTransaction(), {
      wrapper: createWrapper(store),
    });

    act(() => {
      result.current.transact(
        changeCustomAttributes(modelOf(store), [
          { assetId: IDS.J1, attributeId: "ca-1", value: 42 },
        ]),
      );
    });

    expect(applyMomentToDb).toHaveBeenCalledWith(
      expect.objectContaining({
        customAttributesData: {
          upserts: [{ asset_id: IDS.J1, data: JSON.stringify({ "ca-1": 42 }) }],
          deleteIds: [],
        },
      }),
    );
    expect(
      getValue(store.get(customAttributesDataAtom), IDS.J1, "ca-1"),
    ).toEqual(42);
  });

  it("rejects invalid data before mutating and shows changeNotApplied", () => {
    const store = buildStore();
    const { result } = renderHook(() => useModelTransaction(), {
      wrapper: createWrapper(store),
    });

    let applied: boolean | undefined;
    act(() => {
      applied = result.current.transact(
        changeCustomAttributes(modelOf(store), [
          {
            assetId: IDS.J1,
            attributeId: "ca-1",
            value: true as unknown as number,
          },
        ]),
      );
    });

    expect(applied).toBe(false);
    expect(store.get(dialogAtom)).toEqual({ type: "changeNotApplied" });
    expect(
      getValue(store.get(customAttributesDataAtom), IDS.J1, "ca-1"),
    ).toBeNull();
    expect(applyMomentToDb).not.toHaveBeenCalled();
  });

  it("persists the reverted value in the moment payload on undo", () => {
    const store = buildStore();
    const { result } = renderHook(
      () => ({
        model: useModelTransaction(),
        history: useUndoableTransactions(),
      }),
      { wrapper: createWrapper(store) },
    );

    act(() => {
      result.current.model.transact(
        changeCustomAttributes(modelOf(store), [
          { assetId: IDS.J1, attributeId: "ca-1", value: 42 },
        ]),
      );
    });
    vi.mocked(applyMomentToDb).mockClear();

    act(() => {
      result.current.history.historyControl("undo");
    });

    expect(applyMomentToDb).toHaveBeenCalledWith(
      expect.objectContaining({
        customAttributesData: {
          upserts: [
            { asset_id: IDS.J1, data: JSON.stringify({ "ca-1": null }) },
          ],
          deleteIds: [],
        },
      }),
    );
    expect(
      getValue(store.get(customAttributesDataAtom), IDS.J1, "ca-1"),
    ).toBeNull();
  });
});

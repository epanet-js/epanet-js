import { renderHook, act } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import {
  LabelManager,
  initializeModelFactoriesWithPools,
} from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { buildIdPools } from "src/lib/id-pools";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import { modelFactoriesAtom } from "src/state/model-factories";
import type { Store } from "src/state";
import { useCustomerPointsImportReset } from "./use-customer-points-import-reset";

const SEEDS = {
  asset: 10,
  customerPoint: 20,
  pattern: 30,
  curve: 40,
  zone: 50,
} as const;

const aStore = (): Store => {
  const store = setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });
  store.set(
    modelFactoriesAtom,
    initializeModelFactoriesWithPools({
      idPools: buildIdPools(true, { ...SEEDS }),
      labelManager: new LabelManager(),
    }),
  );
  return store;
};

const reset = async (store: Store, idGenerator?: ConsecutiveIdsGenerator) => {
  const { result } = renderHook(() => useCustomerPointsImportReset(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

  await act(async () => {
    await result.current.customerPointsImportReset({
      hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
      idGenerator,
    });
  });
};

describe("useCustomerPointsImportReset id pools", () => {
  useInProcessDb();

  it("adopts the generator the import advanced", async () => {
    const store = aStore();

    await reset(store, new ConsecutiveIdsGenerator(120));

    const { idPools } = store.get(modelFactoriesAtom);
    expect(idPools.newId("customerPoint")).toBe(121);
  });

  it("leaves every other pool where it was", async () => {
    const store = aStore();

    await reset(store, new ConsecutiveIdsGenerator(120));

    const { idPools } = store.get(modelFactoriesAtom);
    expect(idPools.newId("asset")).toBe(SEEDS.asset + 1);
    expect(idPools.newId("pattern")).toBe(SEEDS.pattern + 1);
    expect(idPools.newId("curve")).toBe(SEEDS.curve + 1);
    expect(idPools.newId("zone")).toBe(SEEDS.zone + 1);
  });

  it("keeps the pools untouched when no generator is given", async () => {
    const store = aStore();
    const before = store.get(modelFactoriesAtom);

    await reset(store);

    expect(store.get(modelFactoriesAtom)).toBe(before);
    expect(before.idPools.newId("customerPoint")).toBe(SEEDS.customerPoint + 1);
  });
});

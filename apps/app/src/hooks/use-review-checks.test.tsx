import { render } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { Store } from "src/state";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { reviewResultsAtom } from "src/state/network-review";
import { CheckType } from "src/lib/network-review";
import { useCachedCheck, useReviewChecks } from "./use-review-checks";

const renderCache = <K extends CheckType.orphanAssets>(
  store: Store,
  check: K,
) => {
  const captured = {} as ReturnType<typeof useCachedCheck<K>>;
  const Probe = () => {
    Object.assign(captured, useCachedCheck(check));
    return null;
  };
  render(
    <JotaiProvider store={store}>
      <Probe />
    </JotaiProvider>,
  );
  return captured;
};

const renderChecks = (store: Store) => {
  const captured = {} as ReturnType<typeof useReviewChecks>;
  const Probe = () => {
    Object.assign(captured, useReviewChecks());
    return null;
  };
  render(
    <JotaiProvider store={store}>
      <Probe />
    </JotaiProvider>,
  );
  return captured;
};

const currentVersion = (store: Store) =>
  store.get(stagingModelDerivedAtom).version;

describe("useCachedCheck", () => {
  it("returns nothing when the check has not run", () => {
    const store = setInitialState({});

    expect(renderCache(store, CheckType.orphanAssets).read()).toBeNull();
  });

  it("returns what was written for the current model", () => {
    const store = setInitialState({});
    const cache = renderCache(store, CheckType.orphanAssets);

    cache.write([1, 2], 2, currentVersion(store));

    expect(cache.read()).toEqual([1, 2]);
  });

  it("ignores an entry left over from a previous model version", () => {
    const store = setInitialState({});
    const cache = renderCache(store, CheckType.orphanAssets);
    cache.write([1], 1, currentVersion(store));

    store.set(stagingModelDerivedAtom, {
      ...store.get(stagingModelDerivedAtom),
      version: "a-newer-version",
    });

    expect(cache.read()).toBeNull();
  });

  // A check runs across yields while the model is mutated in place, so a
  // result that outlives its version describes a model that no longer exists.
  it("drops a write whose model version is no longer current", () => {
    const store = setInitialState({});
    const cache = renderCache(store, CheckType.orphanAssets);
    const staleVersion = currentVersion(store);

    store.set(stagingModelDerivedAtom, {
      ...store.get(stagingModelDerivedAtom),
      version: "a-newer-version",
    });
    cache.write([1], 1, staleVersion);

    expect(
      store.get(reviewResultsAtom)[CheckType.orphanAssets],
    ).toBeUndefined();
  });

  it("leaves the other checks' entries alone when one is written", () => {
    const store = setInitialState({});
    const version = currentVersion(store);
    renderCache(store, CheckType.orphanAssets).write([1], 1, version);

    const connectivity = renderCache(
      store,
      CheckType.connectivityTrace as CheckType.orphanAssets,
    );
    connectivity.write([], 0, version);

    expect(store.get(reviewResultsAtom)[CheckType.orphanAssets]).toBeDefined();
  });
});

describe("useReviewChecks", () => {
  const aModelWithAnOrphan = () =>
    HydraulicModelBuilder.with()
      .aReservoir(1, { head: 100 })
      .aJunction(2, { elevation: 10 })
      .aPipe(3, {
        startNodeId: 1,
        endNodeId: 2,
        length: 100,
        diameter: 100,
        roughness: 100,
      })
      .aJunction(4, { elevation: 10 })
      .build();

  it("runs every check when nothing is cached", async () => {
    const store = setInitialState({ hydraulicModel: aModelWithAnOrphan() });

    const results = await renderChecks(store).ensureFresh();

    expect(results).toHaveLength(3);
    const orphans = results.find(
      (result) => result.check === CheckType.orphanAssets,
    );
    expect(orphans?.issueCount).toEqual(1);
  });

  it("serves a cached check without running it again", async () => {
    const store = setInitialState({ hydraulicModel: aModelWithAnOrphan() });
    const checks = renderChecks(store);
    await checks.ensureFresh();

    // A sentinel the check itself could never produce: re-running would find
    // the single real orphan instead.
    store.set(reviewResultsAtom, {
      ...store.get(reviewResultsAtom),
      [CheckType.orphanAssets]: {
        modelVersion: currentVersion(store),
        issueCount: 3,
        items: [901, 902, 903],
      },
    });

    const results = await checks.ensureFresh();
    const orphans = results.find(
      (result) => result.check === CheckType.orphanAssets,
    );

    expect(orphans?.items).toEqual([901, 902, 903]);
  });

  it("recomputes once the model version changes", async () => {
    const store = setInitialState({ hydraulicModel: aModelWithAnOrphan() });
    const checks = renderChecks(store);
    await checks.ensureFresh();

    store.set(stagingModelDerivedAtom, {
      ...store.get(stagingModelDerivedAtom),
      version: "a-newer-version",
    });
    await checks.ensureFresh();

    expect(
      store.get(reviewResultsAtom)[CheckType.orphanAssets]?.modelVersion,
    ).toEqual("a-newer-version");
  });
});

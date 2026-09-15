/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { stubFeatureOff, stubFeaturesOn } from "src/__helpers__/feature-flags";
import { setInitialState } from "src/__helpers__/state";
import { panelsAtom, panelsIn } from "src/state/panels";
import { useDefaultPanels } from "./use-default-panels";

const dockedPanels = (seed: ReturnType<typeof useDefaultPanels>) => {
  const store = setInitialState({});
  store.set(panelsAtom, seed());
  return {
    left: store.get(panelsIn("left")).map((entry) => entry.panel.type),
    bottom: store.get(panelsIn("bottom")).map((entry) => entry.panel.type),
  };
};

describe("useDefaultPanels", () => {
  it("seeds the left dock with the network review", () => {
    const { result } = renderHook(() => useDefaultPanels());

    expect(dockedPanels(result.current).left).toEqual(["network-review"]);
  });

  it("leaves the collections panel out while its flag is off", () => {
    stubFeatureOff("FLAG_SELECTION_SETS");

    const { result } = renderHook(() => useDefaultPanels());

    expect(dockedPanels(result.current).left).toEqual(["network-review"]);
  });

  it("seeds the collections panel beside the network review once its flag is on", () => {
    stubFeaturesOn(["FLAG_SELECTION_SETS"]);

    const { result } = renderHook(() => useDefaultPanels());

    expect(dockedPanels(result.current).left).toEqual([
      "network-review",
      "collections",
    ]);
  });

  it("leaves the bottom dock empty", () => {
    const { result } = renderHook(() => useDefaultPanels());

    expect(dockedPanels(result.current).bottom).toEqual([]);
  });
});

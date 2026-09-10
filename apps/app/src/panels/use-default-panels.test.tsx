/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
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
    stubFeatureOff("FLAG_PARTIAL_DATA_TABLES");

    const { result } = renderHook(() => useDefaultPanels());

    expect(dockedPanels(result.current).left).toEqual(["network-review"]);
  });

  it("seeds the bottom dock with the data tables", () => {
    stubFeatureOff("FLAG_PARTIAL_DATA_TABLES");

    const { result } = renderHook(() => useDefaultPanels());

    expect(dockedPanels(result.current).bottom).not.toHaveLength(0);
  });

  it("keeps the network review when partial data tables empties the bottom dock", () => {
    stubFeatureOn("FLAG_PARTIAL_DATA_TABLES");

    const { result } = renderHook(() => useDefaultPanels());

    expect(dockedPanels(result.current)).toEqual({
      left: ["network-review"],
      bottom: [],
    });
  });
});

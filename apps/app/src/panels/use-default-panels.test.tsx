/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
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
  it("seeds the left dock with the network review and the collections panel", () => {
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

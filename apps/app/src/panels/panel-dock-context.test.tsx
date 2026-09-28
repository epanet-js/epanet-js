/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import type { Dock } from "./docks";
import { PanelDockContext, useSideTowardMap } from "./panel-dock-context";

const sideFrom = (dock: Dock | undefined) =>
  renderHook(() => useSideTowardMap(), {
    wrapper: ({ children }) => (
      <PanelDockContext.Provider value={dock}>
        {children}
      </PanelDockContext.Provider>
    ),
  }).result.current;

describe("useSideTowardMap", () => {
  it("points across the map from either side dock", () => {
    expect(sideFrom("left")).toEqual("right");
    expect(sideFrom("right")).toEqual("left");
  });

  it("points up from the vertical dock, where the map is above", () => {
    expect(sideFrom("vertical")).toEqual("top");
  });
});

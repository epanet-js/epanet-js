/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { createAssetTablePanel } from "./data-tables/create-panel";
import { createHglProfilePanel } from "./hgl-profile/create-panel";
import { useIsPanelClosable } from "./use-panel-closable";

const seededTable = () =>
  createAssetTablePanel("junction", { id: "junction", closable: false });

describe("useIsPanelClosable", () => {
  it("keeps the seeded tables unclosable while the flag is off", () => {
    stubFeatureOff("FLAG_PARTIAL_DATA_TABLES");

    const { result } = renderHook(() => useIsPanelClosable());

    expect(result.current(seededTable())).toBe(false);
  });

  it("makes the seeded tables closable once the flag is on", () => {
    stubFeatureOn("FLAG_PARTIAL_DATA_TABLES");

    const { result } = renderHook(() => useIsPanelClosable());

    expect(result.current(seededTable())).toBe(true);
  });

  it("leaves an already-closable panel closable either way", () => {
    stubFeatureOff("FLAG_PARTIAL_DATA_TABLES");
    const { result: off } = renderHook(() => useIsPanelClosable());
    expect(off.current(createHglProfilePanel())).toBe(true);

    stubFeatureOn("FLAG_PARTIAL_DATA_TABLES");
    const { result: on } = renderHook(() => useIsPanelClosable());
    expect(on.current(createHglProfilePanel())).toBe(true);
  });
});

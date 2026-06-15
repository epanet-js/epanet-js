import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import { createStore, Provider as JotaiProvider } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";
import { useOpenModelBuilder } from "./open-model-builder";

vi.mock("src/infra/user-tracking", () => ({
  useUserTracking: () => ({ capture: vi.fn() }),
}));
// Bypass auth gating: run the callback immediately.
vi.mock("src/hooks/use-early-access", () => ({
  useEarlyAccess: () => (cb: () => void) => cb(),
}));

let canUseModelBuildV2 = false;
vi.mock("src/hooks/use-permissions", () => ({
  usePermissions: () => ({ canUseModelBuildV2 }),
}));

const renderOpen = (store: ReturnType<typeof createStore>) =>
  renderHook(() => useOpenModelBuilder(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

describe("useOpenModelBuilder", () => {
  beforeEach(() => {
    canUseModelBuildV2 = false;
  });

  it("opens the legacy (v1) dialog when FLAG_BUILD_V2 is off", () => {
    stubFeatureOff("FLAG_BUILD_V2");
    const store = createStore();

    const { result } = renderOpen(store);
    act(() => result.current({ source: "toolbar" }));

    expect(store.get(dialogAtom)).toEqual({ type: "modelBuilderIframe" });
  });

  it("opens the v2 dialog when FLAG_BUILD_V2 is on and the user can use it", () => {
    stubFeatureOn("FLAG_BUILD_V2");
    canUseModelBuildV2 = true;
    const store = createStore();

    const { result } = renderOpen(store);
    act(() => result.current({ source: "toolbar" }));

    expect(store.get(dialogAtom)).toEqual({ type: "modelBuilderV2Iframe" });
  });

  it("opens the paywall when FLAG_BUILD_V2 is on and the user cannot use it", () => {
    stubFeatureOn("FLAG_BUILD_V2");
    canUseModelBuildV2 = false;
    const store = createStore();

    const { result } = renderOpen(store);
    act(() => result.current({ source: "toolbar" }));

    expect(store.get(dialogAtom)).toEqual({
      type: "modelBuilderPaywall",
      source: "toolbar",
    });
  });
});

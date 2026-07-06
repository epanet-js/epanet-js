import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import { createStore, Provider as JotaiProvider } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useShowCustomAttributes } from "./show-custom-attributes";

vi.mock("src/infra/user-tracking", () => ({
  useUserTracking: () => ({ capture: vi.fn() }),
}));

let canUseCustomAttributes = false;
vi.mock("src/hooks/use-permissions", () => ({
  usePermissions: () => ({ canUseCustomAttributes }),
}));

const renderShow = (store: ReturnType<typeof createStore>) =>
  renderHook(() => useShowCustomAttributes(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

describe("useShowCustomAttributes", () => {
  beforeEach(() => {
    canUseCustomAttributes = false;
  });

  it("opens the custom attributes dialog when the user can use it", () => {
    canUseCustomAttributes = true;
    const store = createStore();

    const { result } = renderShow(store);
    act(() => result.current({ source: "toolbar", initialAssetType: "pipe" }));

    expect(store.get(dialogAtom)).toEqual({
      type: "customAttributes",
      initialAssetType: "pipe",
    });
  });

  it("opens the paywall when the user cannot use it", () => {
    canUseCustomAttributes = false;
    const store = createStore();

    const { result } = renderShow(store);
    act(() => result.current({ source: "toolbar" }));

    expect(store.get(dialogAtom)).toEqual({
      type: "featurePaywall",
      feature: "customAttributes",
    });
  });
});

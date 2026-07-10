import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import { createStore, Provider as JotaiProvider } from "jotai";
import { dialogAtom } from "src/state/dialog";
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

const startBlankProject = vi.fn().mockResolvedValue(undefined);
vi.mock("src/hooks/persistence/use-start-new-project", () => ({
  useStartBlankProject: () => startBlankProject,
}));

const flushMicrotasks = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

const renderOpen = (store: ReturnType<typeof createStore>) =>
  renderHook(() => useOpenModelBuilder(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

describe("useOpenModelBuilder", () => {
  beforeEach(() => {
    canUseModelBuildV2 = false;
    startBlankProject.mockClear();
  });

  it("opens the v2 dialog when the user can use it", async () => {
    canUseModelBuildV2 = true;
    const store = createStore();

    const { result } = renderOpen(store);
    await act(async () => {
      result.current({ source: "toolbar" });
      await flushMicrotasks();
    });

    expect(store.get(dialogAtom)).toEqual({ type: "modelBuilderV2Iframe" });
  });

  it("clears the project to empty before opening the dialog", async () => {
    canUseModelBuildV2 = true;
    const store = createStore();
    startBlankProject.mockImplementation(() => {
      expect(store.get(dialogAtom)).toBeNull();
      return Promise.resolve();
    });

    const { result } = renderOpen(store);
    await act(async () => {
      result.current({ source: "toolbar" });
      await flushMicrotasks();
    });

    expect(startBlankProject).toHaveBeenCalledTimes(1);
    expect(store.get(dialogAtom)).toEqual({ type: "modelBuilderV2Iframe" });
  });

  it("opens the paywall without clearing the project", async () => {
    canUseModelBuildV2 = false;
    const store = createStore();

    const { result } = renderOpen(store);
    await act(async () => {
      result.current({ source: "toolbar" });
      await flushMicrotasks();
    });

    expect(store.get(dialogAtom)).toEqual({
      type: "modelBuilderPaywall",
      source: "toolbar",
    });
    expect(startBlankProject).not.toHaveBeenCalled();
  });
});

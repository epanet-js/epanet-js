import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { createStore, Provider as JotaiProvider } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { ModelBuilderPaywallDialog } from "./model-builder-paywall";

vi.mock("src/infra/user-tracking", () => ({
  useUserTracking: () => ({ capture: vi.fn() }),
}));
vi.mock("src/hooks/use-early-access", () => ({
  useEarlyAccess: () => (cb: () => void) => cb(),
}));

const renderDialog = (store: ReturnType<typeof createStore>) =>
  render(
    <JotaiProvider store={store}>
      <ModelBuilderPaywallDialog source="toolbar" onClose={vi.fn()} />
    </JotaiProvider>,
  );

describe("ModelBuilderPaywallDialog", () => {
  it("opens the legacy (v1) dialog when continuing with legacy", () => {
    const store = createStore();
    renderDialog(store);

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Legacy" }),
    );

    expect(store.get(dialogAtom)).toEqual({ type: "modelBuilderIframe" });
  });

  it("opens the upgrade dialog when upgrading", () => {
    const store = createStore();
    renderDialog(store);

    fireEvent.click(screen.getByRole("button", { name: "Upgrade" }));

    expect(store.get(dialogAtom)).toEqual({
      type: "upgrade",
      source: { kind: "modelBuilder" },
    });
  });
});

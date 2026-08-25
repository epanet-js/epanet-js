import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { Provider as JotaiProvider } from "jotai";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";
import { Store } from "src/state";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { historyPendingAtom } from "src/state/transactions";
import { ConnectivityTrace } from "./connectivity-trace";

vi.mock("src/hooks/use-zoom-to", () => ({ useZoomTo: () => vi.fn() }));
vi.mock("src/infra/user-tracking", () => ({
  useUserTracking: () => ({ capture: vi.fn() }),
}));

// The shared ResizeObserver stub feeds react-virtual's measureElement an entry
// without a target; a no-op keeps the virtualized list from crashing in jsdom.
beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
});

const renderPanel = (store: Store) => {
  render(
    <JotaiProvider store={store}>
      <TooltipProvider>
        <ConnectivityTrace onGoBack={vi.fn()} />
      </TooltipProvider>
    </JotaiProvider>,
  );
};

// A supplied network (reservoir) plus a detached, unsupplied pair of junctions.
const IDS = { R1: 1, J1: 2, SUPPLIED: 3, J2: 4, J3: 5, ORPHANED: 6 } as const;

const aModelWithAnUnsuppliedSubnetwork = () =>
  HydraulicModelBuilder.with()
    .aReservoir(IDS.R1)
    .aJunction(IDS.J1)
    .aPipe(IDS.SUPPLIED, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
    .aJunction(IDS.J2)
    .aJunction(IDS.J3)
    .aPipe(IDS.ORPHANED, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
    .build();

const listElement = () =>
  screen.getByRole("list").parentElement!.parentElement!;

describe("ConnectivityTrace panel fix action", () => {
  it("does not render a fix action when the flag is off", async () => {
    stubFeatureOff("FLAG_DISABLE_UNSUPPLIED_SUBNETWORK");
    const hydraulicModel = aModelWithAnUnsuppliedSubnetwork();
    renderPanel(setInitialState({ hydraulicModel }));

    await waitFor(() => {
      expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole("button", { name: /disable/i })).toBeNull();
  });

  it("offers the fix only for the unsupplied subnetwork", async () => {
    stubFeatureOn("FLAG_DISABLE_UNSUPPLIED_SUBNETWORK");
    const hydraulicModel = aModelWithAnUnsuppliedSubnetwork();
    renderPanel(setInitialState({ hydraulicModel }));

    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });
    expect(screen.getAllByRole("button", { name: /disable/i })).toHaveLength(1);
  });

  it("deactivates the unsupplied subnetwork's links", async () => {
    stubFeatureOn("FLAG_DISABLE_UNSUPPLIED_SUBNETWORK");
    const hydraulicModel = aModelWithAnUnsuppliedSubnetwork();
    const store = setInitialState({ hydraulicModel });
    renderPanel(store);

    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    fireEvent.click(screen.getByRole("button", { name: /disable/i }));

    await waitFor(() => {
      const model = store.get(stagingModelDerivedAtom);
      expect(model.assets.get(IDS.ORPHANED)?.isActive).toBe(false);
      expect(model.assets.get(IDS.SUPPLIED)?.isActive).toBe(true);
    });
  });

  it("deactivates the selected subnetwork when pressing Enter", async () => {
    stubFeatureOn("FLAG_DISABLE_UNSUPPLIED_SUBNETWORK");
    const hydraulicModel = aModelWithAnUnsuppliedSubnetwork();
    const store = setInitialState({ hydraulicModel });
    renderPanel(store);

    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    fireEvent.click(screen.getByRole("button", { name: "Network 2" }));
    fireEvent.keyDown(listElement(), { key: "Enter" });

    await waitFor(() => {
      expect(
        store.get(stagingModelDerivedAtom).assets.get(IDS.ORPHANED)?.isActive,
      ).toBe(false);
    });
  });

  it("does not disable a supplied subnetwork via Enter", async () => {
    stubFeatureOn("FLAG_DISABLE_UNSUPPLIED_SUBNETWORK");
    const hydraulicModel = aModelWithAnUnsuppliedSubnetwork();
    const store = setInitialState({ hydraulicModel });
    renderPanel(store);

    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    fireEvent.click(screen.getByRole("button", { name: "Network 1" }));
    fireEvent.keyDown(listElement(), { key: "Enter" });

    await waitFor(() => {
      expect(
        store.get(stagingModelDerivedAtom).assets.get(IDS.SUPPLIED)?.isActive,
      ).toBe(true);
    });
  });

  it("advances on Enter even when the row has no fix", async () => {
    stubFeatureOn("FLAG_DISABLE_UNSUPPLIED_SUBNETWORK");
    const hydraulicModel = aModelWithAnUnsuppliedSubnetwork();
    renderPanel(setInitialState({ hydraulicModel }));

    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    fireEvent.click(screen.getByRole("button", { name: "Network 1" }));
    fireEvent.keyDown(listElement(), { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Network 2" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
  });

  it("does not fix via Enter while edition is blocked", async () => {
    stubFeatureOn("FLAG_DISABLE_UNSUPPLIED_SUBNETWORK");
    const hydraulicModel = aModelWithAnUnsuppliedSubnetwork();
    const store = setInitialState({ hydraulicModel });
    store.set(historyPendingAtom, true);
    renderPanel(store);

    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    fireEvent.click(screen.getByRole("button", { name: "Network 2" }));
    fireEvent.keyDown(listElement(), { key: "Enter" });

    await waitFor(() => {
      expect(
        store.get(stagingModelDerivedAtom).assets.get(IDS.ORPHANED)?.isActive,
      ).toBe(true);
    });
  });
});

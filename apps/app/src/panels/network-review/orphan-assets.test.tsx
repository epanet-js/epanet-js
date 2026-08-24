import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { Provider as JotaiProvider } from "jotai";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";
import { Store } from "src/state";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { OrphanAssets } from "./orphan-assets";

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
        <OrphanAssets onGoBack={vi.fn()} />
      </TooltipProvider>
    </JotaiProvider>,
  );
};

const aModelWithAnOrphanJunction = () => {
  const IDS = { J1: 1, J2: 2, P1: 3, Orphan: 4 } as const;
  const hydraulicModel = HydraulicModelBuilder.with()
    .aJunction(IDS.J1)
    .aJunction(IDS.J2)
    .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
    .aJunction(IDS.Orphan, { label: "ORPHAN" })
    .build();
  return { IDS, hydraulicModel };
};

describe("OrphanAssets panel fix action", () => {
  it("does not render a fix action when the flag is off", async () => {
    stubFeatureOff("FLAG_FIX_ORPHAN_ASSET");
    const { hydraulicModel } = aModelWithAnOrphanJunction();
    renderPanel(setInitialState({ hydraulicModel }));

    await waitFor(() => {
      expect(screen.getByText("ORPHAN")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("deletes the orphan when the fix button is clicked", async () => {
    stubFeatureOn("FLAG_FIX_ORPHAN_ASSET");
    const { IDS, hydraulicModel } = aModelWithAnOrphanJunction();
    const store = setInitialState({ hydraulicModel });
    renderPanel(store);

    await waitFor(() => {
      expect(screen.getByText("ORPHAN")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(
        store.get(stagingModelDerivedAtom).assets.get(IDS.Orphan),
      ).toBeUndefined();
    });
  });

  it("deletes the selected orphan when pressing Enter on the list", async () => {
    stubFeatureOn("FLAG_FIX_ORPHAN_ASSET");
    const { IDS, hydraulicModel } = aModelWithAnOrphanJunction();
    const store = setInitialState({ hydraulicModel });
    renderPanel(store);

    await waitFor(() => {
      expect(screen.getByText("ORPHAN")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("ORPHAN"));
    const list = screen.getByRole("list").parentElement!.parentElement!;
    fireEvent.keyDown(list, { key: "Enter" });

    await waitFor(() => {
      expect(
        store.get(stagingModelDerivedAtom).assets.get(IDS.Orphan),
      ).toBeUndefined();
    });
  });

  it("selects the next issue so Enter can be pressed repeatedly", async () => {
    stubFeatureOn("FLAG_FIX_ORPHAN_ASSET");
    const IDS = { J1: 1, J2: 2, P1: 3, A: 4, B: 5, C: 6 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aJunction(IDS.A, { label: "AAA" })
      .aJunction(IDS.B, { label: "BBB" })
      .aJunction(IDS.C, { label: "CCC" })
      .build();
    const store = setInitialState({ hydraulicModel });
    renderPanel(store);

    await waitFor(() => {
      expect(screen.getByText(/3 issues found/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("AAA"));
    const list = screen.getByRole("list").parentElement!.parentElement!;

    for (const label of ["AAA", "BBB", "CCC"]) {
      await waitFor(() => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
      fireEvent.keyDown(list, { key: "Enter" });
    }

    await waitFor(() => {
      const model = store.get(stagingModelDerivedAtom);
      expect(model.assets.get(IDS.A)).toBeUndefined();
      expect(model.assets.get(IDS.B)).toBeUndefined();
      expect(model.assets.get(IDS.C)).toBeUndefined();
    });
  });

  it("disconnects customer points when deleting a dangling pipe", async () => {
    stubFeatureOn("FLAG_FIX_ORPHAN_ASSET");
    const IDS = { J1: 1, J2: 2, P1: 3, CP: 10 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2, label: "PIPE" })
      .aCustomerPoint(IDS.CP, {
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .build();

    hydraulicModel.assets.delete(IDS.J2);
    hydraulicModel.assetIndex.removeNode(IDS.J2);

    const store = setInitialState({ hydraulicModel });
    renderPanel(store);

    await waitFor(() => {
      expect(screen.getByText("PIPE")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      const model = store.get(stagingModelDerivedAtom);
      expect(model.assets.get(IDS.P1)).toBeUndefined();
      expect(model.customerPoints.get(IDS.CP)?.connection).toBeNull();
    });
  });
});

/**
 * @vitest-environment jsdom
 *
 * Behavioural coverage of the FLAG_DATA_TABLES_PERFORMANCE path, where grid rows
 * are the model objects themselves (read via accessorKey/accessorFn) and edits
 * flow back through `patchModelRow` + the model transaction.
 */
import "src/__helpers__/user-tracking";
import "src/__helpers__/locale";
import { stubFeatureOn } from "src/__helpers__/feature-flags";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";

import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { PersistenceContext } from "src/lib/persistence/context";
import { Persistence } from "src/lib/persistence/persistence";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import type { Store } from "src/state";

import { AssetDataTable } from "./asset-data-table";

const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

const renderTable = (store: Store) => {
  const persistence = new Persistence(store);
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <JotaiProvider store={store}>
        <PersistenceContext.Provider value={persistence}>
          <TooltipProvider>
            <AssetDataTable assetType="junction" />
          </TooltipProvider>
        </PersistenceContext.Provider>
      </JotaiProvider>
    </QueryClientProvider>,
  );
};

describe("AssetDataTable (FLAG_DATA_TABLES_PERFORMANCE)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubUserTracking();
    stubFeatureOn("FLAG_DATA_TABLES_PERFORMANCE");
  });

  it("renders model objects directly (direct attribute + computed column)", async () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1", elevation: 25 })
      .aJunctionDemand(1, [{ baseDemand: 10 }])
      .build();
    const store = setInitialState({ hydraulicModel });

    renderTable(store);

    // The grid mount is deferred a frame; the label (accessorKey) appears once
    // it mounts. No async row build is involved.
    expect(await screen.findByDisplayValue("J1")).toBeInTheDocument();
    // Computed demand column (accessorFn) resolved from the model.
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();
  });

  it("edits a label and writes it back to the model", async () => {
    const user = setupUser();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1", elevation: 25 })
      .aJunction(2, { label: "J2", elevation: 30 })
      .build();
    const store = setInitialState({ hydraulicModel });

    renderTable(store);

    const cell = await screen.findByDisplayValue("J1");
    await user.dblClick(cell);
    await waitFor(() => {
      expect(screen.getByDisplayValue("J1")).not.toHaveAttribute("readonly");
    });

    const input = screen.getByDisplayValue("J1");
    await user.clear(input);
    await user.type(input, "J9{Enter}");

    // The edit round-trips through the model and the row re-renders from it.
    await waitFor(() => {
      const model = store.get(stagingModelDerivedAtom);
      expect(model.assets.get(1)?.label).toBe("J9");
    });
  });
});

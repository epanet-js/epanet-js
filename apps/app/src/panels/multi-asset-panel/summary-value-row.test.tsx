import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { LabelManager } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Store } from "src/state";
import { selectionAtom } from "src/state/selection";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { branchStateAtom } from "src/state/branch-state";
import { initialSimulationState } from "src/state/simulation";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { MomentLog } from "src/lib/persistence/moment-log";
import { PersistenceContext } from "src/lib/persistence/context";
import { Persistence } from "src/lib/persistence/persistence";
import { USelection } from "src/selection";
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";
import FeatureEditor from "../feature-editor";

const IDS = { J1: 1, J2: 2 };

const buildModel = (
  elevations: [number, number] = [100, 100],
): HydraulicModel =>
  HydraulicModelBuilder.with()
    .aJunction(IDS.J1, { label: "J1", elevation: elevations[0] })
    .aJunction(IDS.J2, { label: "J2", elevation: elevations[1] })
    .build();

const setInitialState = (hydraulicModel: HydraulicModel): Store => {
  const store = createStore();
  store.set(stagingModelAtom, hydraulicModel);
  store.set(selectionAtom, USelection.fromAssetIds([IDS.J1, IDS.J2]));
  store.set(
    branchStateAtom,
    new Map([
      [
        "main",
        {
          version: hydraulicModel.version,
          hydraulicModel,
          labelManager: new LabelManager(),
          momentLog: new MomentLog(),
          simulation: initialSimulationState,
          simulationSourceId: "main",
          simulationSettings: defaultSimulationSettings,
        },
      ],
    ]),
  );
  return store;
};

const renderComponent = (store: Store) => {
  const persistence = new Persistence(store);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <JotaiProvider store={store}>
        <PersistenceContext.Provider value={persistence}>
          <TooltipProvider>
            <FeatureEditor />
          </TooltipProvider>
        </PersistenceContext.Provider>
      </JotaiProvider>
    </QueryClientProvider>,
  );
};

describe("multi-asset summary rows with FLAG_STATS_PERF", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_STATS_PERF");
  });

  it("shows the mixed placeholder when values differ", () => {
    renderComponent(setInitialState(buildModel([100, 150])));

    expect(screen.getByPlaceholderText(/2 values/i)).toBeInTheDocument();
  });

  it("shows the shared value when all assets agree", () => {
    renderComponent(setInitialState(buildModel([100, 100])));

    const inputs = screen
      .getAllByLabelText(/elevation/i)
      .filter((el): el is HTMLInputElement => el.tagName === "INPUT");
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs[0]).toHaveDisplayValue(/100/);
  });

  it("computes the stats lazily when the popover opens", async () => {
    renderComponent(setInitialState(buildModel([100, 150])));

    await userEvent.click(
      screen.getByRole("button", { name: /stats for: elevation/i }),
    );

    const minField = screen.getByLabelText<HTMLInputElement>(/value for: min/i);
    const maxField = screen.getByLabelText<HTMLInputElement>(/value for: max/i);
    expect(minField.value).toMatch(/^100(\.0+)?$/);
    expect(maxField.value).toMatch(/^150(\.0+)?$/);
  });

  it("renders the (virtualized) value list in the popover", async () => {
    renderComponent(setInitialState(buildModel([100, 150])));

    await userEvent.click(
      screen.getByRole("button", { name: /stats for: elevation/i }),
    );

    expect(screen.getByRole("table", { name: /values/i })).toBeInTheDocument();
  });

  it("keeps the stats popover button when the flag is off", () => {
    stubFeatureOff("FLAG_STATS_PERF");
    renderComponent(setInitialState(buildModel([100, 150])));

    expect(screen.getAllByLabelText(/stats for:/i).length).toBeGreaterThan(0);
  });
});

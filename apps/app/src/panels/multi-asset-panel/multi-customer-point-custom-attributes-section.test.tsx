import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { LabelManager } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Store } from "src/state";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { branchStateAtom } from "src/state/branch-state";
import { initialSimulationState } from "src/state/simulation";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { MomentLog } from "src/lib/persistence/moment-log";
import { PersistenceContext } from "src/lib/persistence/context";
import { Persistence } from "src/lib/persistence/persistence";
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";
import { MultiCustomerPointCustomAttributesSection } from "./multi-customer-point-custom-attributes-section";

const IDS = { CP1: 1, CP2: 2 };

const buildModel = (values: Record<number, number> = {}): HydraulicModel => {
  const model = HydraulicModelBuilder.with()
    .aCustomAttribute("customerPoint", {
      id: "custom-1",
      label: "Age",
      type: "number",
    })
    .aCustomerPoint(IDS.CP1, { label: "CP1" })
    .aCustomerPoint(IDS.CP2, { label: "CP2" })
    .build();
  for (const [id, value] of Object.entries(values)) {
    model.customerPoints.get(Number(id))!.setProperty("custom-1", value);
  }
  return model;
};

const setInitialState = (
  hydraulicModel: HydraulicModel = buildModel(),
): Store => {
  const store = createStore();
  store.set(stagingModelAtom, hydraulicModel);
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

const renderSection = (store: Store, customerPointIds: number[]) => {
  const persistence = new Persistence(store);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <JotaiProvider store={store}>
        <PersistenceContext.Provider value={persistence}>
          <TooltipProvider>
            <MultiCustomerPointCustomAttributesSection
              customerPointIds={customerPointIds}
            />
          </TooltipProvider>
        </PersistenceContext.Provider>
      </JotaiProvider>
    </QueryClientProvider>,
  );
};

describe("MultiCustomerPointCustomAttributesSection", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_CUSTOM_ATTRIBUTES");
  });

  it("shows the section with the custom attribute field", () => {
    const store = setInitialState();
    renderSection(store, [IDS.CP1, IDS.CP2]);

    expect(screen.getByText("Custom attributes")).toBeInTheDocument();
    expect(screen.getByLabelText(/value for: Age/i)).toBeInTheDocument();
  });

  it("does not render when the flag is off", () => {
    stubFeatureOff("FLAG_CUSTOM_ATTRIBUTES");
    const store = setInitialState();
    renderSection(store, [IDS.CP1, IDS.CP2]);

    expect(screen.queryByText("Custom attributes")).not.toBeInTheDocument();
  });

  it("shows a mixed placeholder when values differ", () => {
    const store = setInitialState(buildModel({ [IDS.CP1]: 10, [IDS.CP2]: 20 }));
    renderSection(store, [IDS.CP1, IDS.CP2]);

    expect(screen.getByPlaceholderText("2 values")).toBeInTheDocument();
  });

  it("writes the edited value to every selected customer point", async () => {
    const store = setInitialState();
    renderSection(store, [IDS.CP1, IDS.CP2]);

    const input = screen.getByLabelText(/value for: Age/i);
    await userEvent.click(input);
    await userEvent.keyboard("99{Enter}");

    await waitFor(() => {
      const model = store.get(stagingModelDerivedAtom);
      expect(model.customerPoints.get(IDS.CP1)!.getProperty("custom-1")).toBe(
        99,
      );
      expect(model.customerPoints.get(IDS.CP2)!.getProperty("custom-1")).toBe(
        99,
      );
    });
  });
});

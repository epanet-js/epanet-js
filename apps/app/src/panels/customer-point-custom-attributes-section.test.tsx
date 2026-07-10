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
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { branchStateAtom } from "src/state/branch-state";
import { worktreeAtom } from "src/state/scenarios";
import type { Branch, Worktree } from "src/lib/worktree/types";
import { initialSimulationState } from "src/state/simulation";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { MomentLog } from "src/lib/persistence/moment-log";
import { PersistenceContext } from "src/lib/persistence/context";
import { Persistence } from "src/lib/persistence/persistence";
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { CustomerPointCustomAttributesSection } from "./customer-point-custom-attributes-section";

const IDS = { CP1: 1 };

const buildModel = (value: string | null = null): HydraulicModel => {
  const model = HydraulicModelBuilder.with()
    .aCustomAttribute("customerPoint", {
      id: "custom-1",
      label: "Zone",
      type: "text",
    })
    .aCustomerPoint(IDS.CP1, { label: "CP1" })
    .build();
  if (value !== null) {
    model.customerPoints.get(IDS.CP1)!.setProperty("custom-1", value);
  }
  return model;
};

const branchState = (hydraulicModel: HydraulicModel) => ({
  version: hydraulicModel.version,
  hydraulicModel,
  labelManager: new LabelManager(),
  momentLog: new MomentLog(),
  simulation: initialSimulationState,
  simulationSourceId: "main",
  simulationSettings: defaultSimulationSettings,
});

const setInitialState = (hydraulicModel: HydraulicModel): Store => {
  const store = createStore();
  store.set(stagingModelDerivedAtom, hydraulicModel);
  store.set(branchStateAtom, new Map([["main", branchState(hydraulicModel)]]));
  return store;
};

const mainBranch: Branch = {
  id: "main",
  name: "Main",
  parentId: null,
  status: "locked",
};
const scenarioBranch: Branch = {
  id: "scenario-1",
  name: "Scenario 1",
  parentId: "main",
  status: "open",
};

const scenarioWorktree: Worktree = {
  activeBranchId: "scenario-1",
  lastActiveBranchId: "main",
  branches: new Map([
    ["main", mainBranch],
    ["scenario-1", scenarioBranch],
  ]),
  mainId: "main",
  scenarios: ["scenario-1"],
  highestScenarioNumber: 1,
};

const setScenarioState = ({
  mainModel,
  scenarioModel,
}: {
  mainModel: HydraulicModel;
  scenarioModel: HydraulicModel;
}): Store => {
  const store = createStore();
  store.set(stagingModelDerivedAtom, scenarioModel);
  store.set(worktreeAtom, scenarioWorktree);
  store.set(
    branchStateAtom,
    new Map([
      ["main", branchState(mainModel)],
      ["scenario-1", branchState(scenarioModel)],
    ]),
  );
  return store;
};

const renderSection = (store: Store) => {
  const persistence = new Persistence(store);
  const customerPoint = store
    .get(stagingModelDerivedAtom)
    .customerPoints.get(IDS.CP1)!;
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <JotaiProvider store={store}>
        <PersistenceContext.Provider value={persistence}>
          <TooltipProvider>
            <CustomerPointCustomAttributesSection
              customerPoint={customerPoint}
            />
          </TooltipProvider>
        </PersistenceContext.Provider>
      </JotaiProvider>
    </QueryClientProvider>,
  );
};

describe("CustomerPointCustomAttributesSection", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_CUSTOM_ATTRIBUTES");
  });

  it("renders the current value", () => {
    const store = setInitialState(buildModel("north"));
    renderSection(store);

    expect(screen.getByText("Custom attributes")).toBeInTheDocument();
    expect(screen.getByLabelText(/value for: Zone/i)).toHaveValue("north");
  });

  it("does not render when the flag is off", () => {
    stubFeatureOff("FLAG_CUSTOM_ATTRIBUTES");
    const store = setInitialState(buildModel());
    renderSection(store);

    expect(screen.queryByText("Custom attributes")).not.toBeInTheDocument();
  });

  it("writes the edited value to the customer point", async () => {
    const store = setInitialState(buildModel());
    renderSection(store);

    const input = screen.getByLabelText(/value for: Zone/i);
    await userEvent.click(input);
    await userEvent.keyboard("south{Enter}");

    await waitFor(() => {
      const model = store.get(stagingModelDerivedAtom);
      expect(model.customerPoints.get(IDS.CP1)!.getProperty("custom-1")).toBe(
        "south",
      );
    });
  });

  it("reports the edit under a distinct custom-attribute event", async () => {
    const tracking = stubUserTracking();
    const store = setInitialState(buildModel());
    renderSection(store);

    const input = screen.getByLabelText(/value for: Zone/i);
    await userEvent.click(input);
    await userEvent.keyboard("south{Enter}");

    await waitFor(() => {
      expect(tracking.capture).toHaveBeenCalledWith({
        name: "customAttribute.edited",
        assetType: "customerPoint",
        attributeType: "text",
        property: "custom-1",
        label: "Zone",
      });
    });
  });
});

describe("CustomerPointCustomAttributesSection scenario highlighting", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_CUSTOM_ATTRIBUTES");
  });

  it("highlights the field when the value differs from main", () => {
    const store = setScenarioState({
      mainModel: buildModel("north"),
      scenarioModel: buildModel("south"),
    });

    const { container } = renderSection(store);

    expect(screen.getByLabelText(/value for: Zone/i)).toHaveValue("south");
    expect(container.querySelector(".bg-accent")).toBeInTheDocument();
  });

  it("does not highlight the field when the value matches main", () => {
    const store = setScenarioState({
      mainModel: buildModel("north"),
      scenarioModel: buildModel("north"),
    });

    const { container } = renderSection(store);

    expect(screen.getByLabelText(/value for: Zone/i)).toHaveValue("north");
    expect(container.querySelector(".bg-accent")).not.toBeInTheDocument();
  });

  it("does not highlight when editing on main", () => {
    const store = setInitialState(buildModel("north"));

    const { container } = renderSection(store);

    expect(screen.getByText("Custom attributes")).toBeInTheDocument();
    expect(container.querySelector(".bg-accent")).not.toBeInTheDocument();
  });
});

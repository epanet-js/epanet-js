import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { customPropertyKey } from "@epanet-js/custom-attributes";
import { LabelManager } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Store } from "src/state";
import { selectionAtom } from "src/state/selection";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { branchStateAtom } from "src/state/branch-state";
import { worktreeAtom } from "src/state/scenarios";
import type { Branch, Worktree } from "src/lib/worktree/types";
import { initialSimulationState } from "src/state/simulation";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { MomentLog } from "src/lib/persistence/moment-log";
import { PersistenceContext } from "src/lib/persistence/context";
import { Persistence } from "src/lib/persistence/persistence";
import { USelection } from "src/selection";
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";
import FeatureEditor from "../feature-editor";

const IDS = { J1: 1 };
const KEY = customPropertyKey("ca-1");

const buildModel = (customValue: number | null): HydraulicModel => {
  const model = HydraulicModelBuilder.with()
    .aCustomAttribute("junction", { id: "ca-1", label: "Age", type: "number" })
    .aJunction(IDS.J1, { label: "J1" })
    .build();
  if (customValue !== null) {
    model.assets.get(IDS.J1)!.setProperty(KEY, customValue);
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
  store = createStore(),
  mainModel,
  scenarioModel,
}: {
  store?: Store;
  mainModel: HydraulicModel;
  scenarioModel: HydraulicModel;
}): Store => {
  store.set(stagingModelAtom, scenarioModel);
  store.set(selectionAtom, USelection.fromAssetIds([IDS.J1]));
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

const setMainState = ({
  store = createStore(),
  hydraulicModel,
}: {
  store?: Store;
  hydraulicModel: HydraulicModel;
}): Store => {
  store.set(stagingModelAtom, hydraulicModel);
  store.set(selectionAtom, USelection.fromAssetIds([IDS.J1]));
  store.set(branchStateAtom, new Map([["main", branchState(hydraulicModel)]]));
  return store;
};

const renderComponent = (store: Store) => {
  const persistence = new Persistence(store);
  return render(
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

describe("CustomAttributesSection scenario highlighting", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_CUSTOM_ATTRIBUTES");
  });

  it("highlights the field when the value differs from main", () => {
    const store = setScenarioState({
      mainModel: buildModel(10),
      scenarioModel: buildModel(20),
    });

    const { container } = renderComponent(store);

    expect(screen.getByLabelText(/value for: Age/i)).toHaveValue("20");
    expect(container.querySelector(".bg-accent")).toBeInTheDocument();
  });

  it("does not highlight the field when the value matches main", () => {
    const store = setScenarioState({
      mainModel: buildModel(10),
      scenarioModel: buildModel(10),
    });

    const { container } = renderComponent(store);

    expect(screen.getByLabelText(/value for: Age/i)).toHaveValue("10");
    expect(container.querySelector(".bg-accent")).not.toBeInTheDocument();
  });

  it("does not highlight when editing on main", () => {
    const store = setMainState({ hydraulicModel: buildModel(10) });

    const { container } = renderComponent(store);

    expect(screen.getByText("Custom attributes")).toBeInTheDocument();
    expect(container.querySelector(".bg-accent")).not.toBeInTheDocument();
  });

  it("does not render the section when the flag is off", () => {
    stubFeatureOff("FLAG_CUSTOM_ATTRIBUTES");
    const store = setScenarioState({
      mainModel: buildModel(10),
      scenarioModel: buildModel(20),
    });

    renderComponent(store);

    expect(screen.queryByText("Custom attributes")).not.toBeInTheDocument();
  });
});

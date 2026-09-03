import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { LabelManager } from "@epanet-js/hydraulic-model";
import type { PipeMaterial } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Store } from "src/state";
import { selectionAtom } from "src/state/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { branchStateAtom } from "src/state/branch-state";
import { worktreeAtom } from "src/state/scenarios";
import type { Branch, Worktree } from "@epanet-js/worktree";
import { initialSimulationState } from "src/state/simulation";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { MomentLog } from "src/lib/persistence/moment-log";
import { SessionHistory } from "src/lib/persistence/session-history";
import { PersistenceContext } from "src/lib/persistence/context";
import { Persistence } from "src/lib/persistence/persistence";
import { USelection } from "src/selection";
import FeatureEditor from "../feature-editor";

const IDS = { P1: 1 };

describe("pipe roughness comparison against the base branch", () => {
  it("highlights when only the pipe library differs between branches", () => {
    const store = setScenarioState({
      mainModel: buildModel(castIron(120)),
      scenarioModel: buildModel(castIron(90)),
    });

    const { container } = renderComponent(store);

    expect(roughnessField()).toHaveAttribute("placeholder", "90");
    expect(container.querySelector(".bg-accent")).toBeInTheDocument();
  });

  it("does not highlight when both branches infer the same value", () => {
    const store = setScenarioState({
      mainModel: buildModel(castIron(120)),
      scenarioModel: buildModel(castIron(120)),
    });

    const { container } = renderComponent(store);

    expect(roughnessField()).toHaveAttribute("placeholder", "120");
    expect(container.querySelector(".bg-accent")).not.toBeInTheDocument();
  });

  it("highlights when the scenario sets a roughness the base branch infers differently", () => {
    const scenarioModel = buildModel(castIron(120));
    scenarioModel.assets.get(IDS.P1)!.setProperty("roughness", 75);
    const store = setScenarioState({
      mainModel: buildModel(castIron(120)),
      scenarioModel,
    });

    const { container } = renderComponent(store);

    expect(roughnessField()).toHaveValue("75");
    expect(container.querySelector(".bg-accent")).toBeInTheDocument();
  });
});

const castIron = (roughness: number): PipeMaterial => ({
  label: "Cast Iron",
  entries: [{ age: 0, roughness }],
});

const buildModel = (material: PipeMaterial): HydraulicModel =>
  HydraulicModelBuilder.with()
    .aPipe(IDS.P1, { label: "P1", roughness: null, material: material.label })
    .aPipeMaterial(material)
    .build();

const roughnessField = () =>
  screen.getByRole("textbox", { name: /value for: roughness/i });

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

const branchState = (hydraulicModel: HydraulicModel) => ({
  version: hydraulicModel.version,
  hydraulicModel,
  labelManager: new LabelManager(),
  momentLog: new MomentLog(),
  sessionHistory: new SessionHistory(),
  simulation: initialSimulationState,
  simulationSourceId: "main",
  simulationSettings: defaultSimulationSettings,
});

const setScenarioState = ({
  store = createStore(),
  mainModel,
  scenarioModel,
}: {
  store?: Store;
  mainModel: HydraulicModel;
  scenarioModel: HydraulicModel;
}): Store => {
  store.set(stagingModelDerivedAtom, scenarioModel);
  store.set(selectionAtom, USelection.fromAssetIds([IDS.P1]));
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

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@epanet-js/ui-kit";
import { LabelManager } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { Store } from "src/state";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { branchStateAtom } from "src/state/branch-state";
import { worktreeAtom } from "src/state/scenarios";
import type { Branch, Worktree } from "@epanet-js/worktree";
import { initialSimulationState } from "src/state/simulation";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { SessionHistory } from "src/lib/persistence/session-history";
import { PersistenceContext } from "src/lib/persistence/context";
import { Persistence } from "src/lib/persistence/persistence";
import { ZoneCustomAttributesSection } from "./zone-custom-attributes-section";

const IDS = { Z1: 1 };

const buildModel = (value: string | null = null): HydraulicModel =>
  HydraulicModelBuilder.with()
    .aCustomAttribute("zone", {
      id: "custom-1",
      label: "Area",
      type: "text",
    })
    .aZone({
      id: IDS.Z1,
      label: "NORTH",
      geometry: { type: "MultiPolygon", coordinates: [] },
      bbox: [0, 0, 1, 1],
      customAttributes: value === null ? {} : { "custom-1": value },
    })
    .build();

const branchState = (hydraulicModel: HydraulicModel) => ({
  version: hydraulicModel.version,
  hydraulicModel,
  labelManager: new LabelManager(),
  sessionHistory: new SessionHistory(),
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
  const zone = store.get(stagingModelDerivedAtom).zones.get(IDS.Z1)!;
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <JotaiProvider store={store}>
        <PersistenceContext.Provider value={persistence}>
          <TooltipProvider>
            <ZoneCustomAttributesSection zone={zone} />
          </TooltipProvider>
        </PersistenceContext.Provider>
      </JotaiProvider>
    </QueryClientProvider>,
  );
};

describe("ZoneCustomAttributesSection", () => {
  it("renders the current value", () => {
    const store = setInitialState(buildModel("low"));
    renderSection(store);

    expect(screen.getByText("Custom attributes")).toBeInTheDocument();
    expect(screen.getByLabelText(/value for: Area/i)).toHaveValue("low");
  });

  it("writes the edited value to the zone", async () => {
    const store = setInitialState(buildModel());
    renderSection(store);

    const input = screen.getByLabelText(/value for: Area/i);
    await userEvent.click(input);
    await userEvent.keyboard("high{Enter}");

    await waitFor(() => {
      const model = store.get(stagingModelDerivedAtom);
      expect(model.zones.get(IDS.Z1)!.getProperty("custom-1")).toBe("high");
    });
  });
});

describe("ZoneCustomAttributesSection scenario highlighting", () => {
  it("highlights the field when the value differs from main", () => {
    const store = setScenarioState({
      mainModel: buildModel("low"),
      scenarioModel: buildModel("high"),
    });

    const { container } = renderSection(store);

    expect(screen.getByLabelText(/value for: Area/i)).toHaveValue("high");
    expect(container.querySelector(".bg-accent")).toBeInTheDocument();
  });

  it("does not highlight the field when the value matches main", () => {
    const store = setScenarioState({
      mainModel: buildModel("low"),
      scenarioModel: buildModel("low"),
    });

    const { container } = renderSection(store);

    expect(screen.getByLabelText(/value for: Area/i)).toHaveValue("low");
    expect(container.querySelector(".bg-accent")).not.toBeInTheDocument();
  });

  it("does not highlight when editing on main", () => {
    const store = setInitialState(buildModel("low"));

    const { container } = renderSection(store);

    expect(screen.getByText("Custom attributes")).toBeInTheDocument();
    expect(container.querySelector(".bg-accent")).not.toBeInTheDocument();
  });
});

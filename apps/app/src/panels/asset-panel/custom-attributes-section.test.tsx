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
import { selectionAtom } from "src/state/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
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
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { AuthMockProvider, aUser } from "src/__helpers__/auth-mock";
import type { User } from "src/auth-types";
import { dialogAtom } from "src/state/dialog";
import FeatureEditor from "../feature-editor";

const IDS = { J1: 1 };
const KEY = "custom-1";

const buildModel = (customValue: number | null): HydraulicModel => {
  const model = HydraulicModelBuilder.with()
    .aCustomAttribute("junction", {
      id: "custom-1",
      label: "Age",
      type: "number",
    })
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
  store.set(stagingModelDerivedAtom, scenarioModel);
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
  store.set(stagingModelDerivedAtom, hydraulicModel);
  store.set(selectionAtom, USelection.fromAssetIds([IDS.J1]));
  store.set(branchStateAtom, new Map([["main", branchState(hydraulicModel)]]));
  return store;
};

const renderComponent = (store: Store, user: User = aUser({ plan: "pro" })) => {
  const persistence = new Persistence(store);
  return render(
    <AuthMockProvider user={user} isSignedIn={true}>
      <QueryClientProvider client={new QueryClient()}>
        <JotaiProvider store={store}>
          <PersistenceContext.Provider value={persistence}>
            <TooltipProvider>
              <FeatureEditor />
            </TooltipProvider>
          </PersistenceContext.Provider>
        </JotaiProvider>
      </QueryClientProvider>
    </AuthMockProvider>,
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

describe("CustomAttributesSection paywall", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_CUSTOM_ATTRIBUTES");
  });

  it("shows a padlock and keeps the value read-only for a free plan", () => {
    const store = setMainState({ hydraulicModel: buildModel(10) });

    renderComponent(store, aUser({ plan: "free" }));

    expect(
      screen.getAllByRole("button", { name: "Paid feature: Age" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText(/value for: Age/i)).toHaveValue("10");
  });

  it("opens the custom-attributes paywall when the padlock is clicked", async () => {
    const user = userEvent.setup();
    const store = setMainState({ hydraulicModel: buildModel(10) });

    renderComponent(store, aUser({ plan: "free" }));

    await user.click(
      screen.getAllByRole("button", { name: "Paid feature: Age" })[0],
    );

    expect(store.get(dialogAtom)).toEqual({
      type: "featurePaywall",
      feature: "customAttributes",
    });
  });

  it("does not show a padlock for a paid plan", () => {
    const store = setMainState({ hydraulicModel: buildModel(10) });

    renderComponent(store, aUser({ plan: "pro" }));

    expect(
      screen.queryByRole("button", { name: "Paid feature: Age" }),
    ).not.toBeInTheDocument();
  });
});

describe("CustomAttributesSection tracking", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_CUSTOM_ATTRIBUTES");
  });

  it("reports a custom-attribute edit under a distinct event", async () => {
    const tracking = stubUserTracking();
    const user = userEvent.setup();
    const store = setMainState({ hydraulicModel: buildModel(10) });

    renderComponent(store, aUser({ plan: "pro" }));

    const input = screen.getByLabelText(/value for: Age/i);
    await user.clear(input);
    await user.type(input, "20");
    await user.tab();

    await waitFor(() => {
      expect(tracking.capture).toHaveBeenCalledWith({
        name: "customAttribute.edited",
        assetType: "junction",
        attributeType: "number",
        property: "custom-1",
        label: "Age",
      });
    });
    expect(tracking.capture).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "assetProperty.edited" }),
    );
  });
});

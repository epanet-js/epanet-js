import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  nullBranchingRules,
  type BranchingRules,
  type Worktree,
} from "@epanet-js/worktree";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { AuthMockProvider, aUser } from "src/__helpers__/auth-mock";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { registerBranchingRules } from "src/lib/branching";
import { branchStateAtom, type BranchState } from "src/state/branch-state";
import { dialogAtom } from "src/state/dialog";
import { worktreeAtom } from "src/state/scenarios";
import { Store } from "src/state";
import { ScenarioSwitcher } from "./scenario-switcher";

describe("ScenarioSwitcher", () => {
  beforeEach(() => {
    stubUserTracking();
    stubFeatureOn("FLAG_LAZY_SCENARIOS");
    registerBranchingRules(switchingRules);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(320);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(256);
  });

  afterEach(() => {
    registerBranchingRules(nullBranchingRules);
    vi.restoreAllMocks();
  });

  it("asks to delete an inactive scenario without switching to it", async () => {
    const store = aStoreOnMainWithUnloadedScenario();
    renderComponent(store);

    await openScenarioActions();
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(store.get(dialogAtom)).toMatchObject({
      type: "deleteScenarioConfirmation",
      scenarioId: "scenario-1",
    });
    expect(store.get(worktreeAtom).activeBranchId).toEqual("main");
  });

  it("asks to rename an inactive scenario without switching to it", async () => {
    const store = aStoreOnMainWithUnloadedScenario();
    renderComponent(store);

    await openScenarioActions();
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }));

    expect(store.get(dialogAtom)).toMatchObject({
      type: "renameScenario",
      scenarioId: "scenario-1",
    });
    expect(store.get(worktreeAtom).activeBranchId).toEqual("main");
  });
});

const switchingRules: BranchingRules = {
  ...nullBranchingRules,
  isAvailable: true,
  switchToBranch: (worktree, branchId) => ({
    worktree: { ...worktree, activeBranchId: branchId },
    activated: worktree.branches.get(branchId) ?? null,
  }),
};

const worktreeWithScenario: Worktree = {
  activeBranchId: "main",
  lastActiveBranchId: "main",
  mainId: "main",
  branches: new Map([
    ["main", { id: "main", name: "Main", parentId: null, status: "locked" }],
    [
      "scenario-1",
      {
        id: "scenario-1",
        name: "Scenario #1",
        parentId: "main",
        status: "open",
      },
    ],
  ]),
  scenarios: ["scenario-1"],
  highestScenarioNumber: 1,
};

const aStoreOnMainWithUnloadedScenario = (): Store => {
  const store = setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().build(),
  });
  const branchStates = new Map(store.get(branchStateAtom));
  const {
    hydraulicModel: _hydraulicModel,
    labelManager: _labelManager,
    ...unloaded
  } = branchStates.get("main") as BranchState;
  branchStates.set("scenario-1", unloaded);
  store.set(branchStateAtom, branchStates);
  store.set(worktreeAtom, worktreeWithScenario);
  return store;
};

const openScenarioActions = async () => {
  await userEvent.click(screen.getByRole("button", { name: /Main/ }));
  const row = screen.getByRole("menuitem", {
    name: /Scenario #1/,
  }).parentElement!;
  await userEvent.click(within(row).getByRole("button"));
};

const renderComponent = (store: Store) => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <JotaiProvider store={store}>
        <AuthMockProvider user={aUser({ plan: "pro" })}>
          <Tooltip.Provider>
            <ScenarioSwitcher />
          </Tooltip.Provider>
        </AuthMockProvider>
      </JotaiProvider>
    </QueryClientProvider>,
  );
};

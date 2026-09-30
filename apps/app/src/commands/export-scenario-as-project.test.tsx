import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { nullBranchStore, type Worktree } from "@epanet-js/worktree";
import { stubFileSave } from "src/__helpers__/browser-fs-mock";
import { fileSave } from "browser-fs-access";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { AuthMockProvider, aUser } from "src/__helpers__/auth-mock";
import { registerBranchStore } from "src/lib/branching";
import { branchStateAtom } from "src/state/branch-state";
import { dialogAtom } from "src/state/dialog";
import { projectSettingsAtom } from "src/state/project-settings";
import { worktreeAtom } from "src/state/scenarios";
import { Store } from "src/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useExportScenarioAsProject } from "./export-scenario-as-project";

const auth = vi.hoisted(() => ({ enabled: false }));

vi.mock("src/global-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("src/global-config")>()),
  get isAuthEnabled() {
    return auth.enabled;
  },
}));

describe("exportScenarioAsProject", () => {
  const exportBranch = vi.fn();

  beforeEach(() => {
    stubUserTracking();
    exportBranch.mockResolvedValue(new Uint8Array([1]));
    registerBranchStore({ ...nullBranchStore, exportBranch });
  });

  afterEach(() => {
    registerBranchStore(nullBranchStore);
    exportBranch.mockReset();
    vi.mocked(fileSave).mockReset();
    auth.enabled = false;
  });

  it("saves the active scenario as a project", async () => {
    stubFileSave();
    const store = aStoreInScenario();

    renderComponent({ store });
    await userEvent.click(
      screen.getByRole("button", { name: "Export scenario" }),
    );

    await waitFor(() => expect(fileSave).toHaveBeenCalled());
    expect(vi.mocked(fileSave).mock.calls[0][1]).toMatchObject({
      fileName: "My project - Scenario #1.ejsdb",
    });
    await vi.mocked(fileSave).mock.calls[0][0];
    expect(exportBranch).toHaveBeenCalledWith(
      "scenario-1",
      expect.stringContaining('"name":"My project - Scenario #1"'),
    );
  });

  it("shows the scenarios paywall when the plan does not allow scenarios", async () => {
    const store = aStoreInScenario();

    renderComponent({ store, plan: "free" });
    await userEvent.click(
      screen.getByRole("button", { name: "Export scenario" }),
    );

    expect(store.get(dialogAtom)).toEqual({
      type: "featurePaywall",
      feature: "manageScenarios",
    });
    expect(fileSave).not.toHaveBeenCalled();
    expect(exportBranch).not.toHaveBeenCalled();
  });

  it("asks to sign in when signed out", async () => {
    auth.enabled = true;
    const store = aStoreInScenario();

    renderComponent({ store, isSignedIn: false });
    await userEvent.click(
      screen.getByRole("button", { name: "Export scenario" }),
    );

    expect(store.get(dialogAtom)).toEqual({
      type: "scenarioSignIn",
      source: "exportScenario",
    });
    expect(fileSave).not.toHaveBeenCalled();
    expect(exportBranch).not.toHaveBeenCalled();
  });
});

const scenarioWorktree: Worktree = {
  activeBranchId: "scenario-1",
  lastActiveBranchId: "scenario-1",
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

const aStoreInScenario = (): Store => {
  const store = setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().build(),
  });
  const branchStates = new Map(store.get(branchStateAtom));
  branchStates.set("scenario-1", branchStates.get("main")!);
  store.set(branchStateAtom, branchStates);
  store.set(worktreeAtom, scenarioWorktree);
  store.set(projectSettingsAtom, {
    ...store.get(projectSettingsAtom),
    name: "My project",
  });
  return store;
};

const TestableComponent = () => {
  const exportScenarioAsProject = useExportScenarioAsProject();
  return (
    <button onClick={() => void exportScenarioAsProject({ source: "test" })}>
      Export scenario
    </button>
  );
};

const renderComponent = ({
  store,
  plan = "pro",
  isSignedIn = true,
}: {
  store: Store;
  plan?: "free" | "pro";
  isSignedIn?: boolean;
}) => {
  render(
    <AuthMockProvider user={aUser({ plan })} isSignedIn={isSignedIn}>
      <CommandContainer store={store}>
        <TestableComponent />
      </CommandContainer>
    </AuthMockProvider>,
  );
};

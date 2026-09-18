import { render, screen, waitFor } from "@testing-library/react";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import userEvent from "@testing-library/user-event";
import { inpFileInfoAtom } from "src/state/file-system";
import {
  sessionHistoryDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { mapEditionsTrackerAtom } from "src/state/map";
import { MapEditionsTracker } from "src/map/map-editions-tracker";
import { Store } from "src/state";
import { SessionHistory } from "src/lib/persistence/session-history";
import { ChangeSet } from "@epanet-js/change-set";
import { useNewProject } from "./create-new-project";
import { aFileInfo, setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import { modelFactoriesAtom } from "src/state/model-factories";

const aHistoryWithChanges = () => {
  const sessionHistory = new SessionHistory();
  sessionHistory.append(ChangeSet.of("A", []));
  return sessionHistory;
};

describe("create new project", () => {
  useInProcessDb();

  it("allows to choose the unit system", async () => {
    const store = setInitialState({});

    renderComponent({ store });

    await triggerNew();

    await userEvent.click(
      screen.getByRole("combobox", { name: /flow units/i }),
    );
    await userEvent.click(screen.getByRole("option", { name: /GPM/ }));

    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(store.get(projectSettingsAtom).units.flow).toEqual("gal/min");
  });

  it("allows to chooose the headloss formula", async () => {
    const store = setInitialState({});

    renderComponent({ store });

    await triggerNew();

    await userEvent.click(screen.getByRole("combobox", { name: /headloss/i }));
    await userEvent.click(
      screen.getByRole("option", { name: /Darcy-Weisbach/ }),
    );

    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(store.get(projectSettingsAtom).headlossFormula).toEqual("D-W");
  });

  it("erases the previous state", async () => {
    const IDS = { J1: 1 } as const;
    const previousFileInfo = aFileInfo({
      name: "previous-file",
      options: { type: "inp" },
    });

    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().aJunction(IDS.J1).build(),
      sessionHistory: aHistoryWithChanges(),
      fileInfo: previousFileInfo,
      isProjectSaved: false,
    });
    const previousEditions = new MapEditionsTracker().record({
      note: "Edit",
      deleteAssets: [IDS.J1],
    });
    store.set(mapEditionsTrackerAtom, previousEditions);

    renderComponent({ store });

    await triggerNew();

    await userEvent.click(screen.getByRole("button", { name: /discard/i }));

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    const hydraulicModel = store.get(stagingModelDerivedAtom);
    expect(hydraulicModel.assets.size).toEqual(0);
    expect(store.get(projectSettingsAtom).units.flow).toEqual("l/s");

    expect(store.get(sessionHistoryDerivedAtom).nextUndo()).toBeNull();

    const editionsTracker = store.get(mapEditionsTrackerAtom);
    expect(editionsTracker.editedCount()).toEqual(0);
    expect(editionsTracker.id).not.toEqual(previousEditions.id);

    const fileInfo = store.get(inpFileInfoAtom);
    expect(fileInfo).toBeNull();
  });

  it("preseves state when canceled", async () => {
    const IDS = { J1: 1 } as const;
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().aJunction(IDS.J1).build(),
      sessionHistory: aHistoryWithChanges(),
      isProjectSaved: false,
    });
    renderComponent({ store });

    await triggerNew();

    await userEvent.click(screen.getByRole("button", { name: /discard/i }));

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    const hydraulicModel = store.get(stagingModelDerivedAtom);
    expect(hydraulicModel.assets.get(IDS.J1)).not.toBeUndefined();
  });

  it("builds a factory that leaves roughness empty when validation is on", async () => {
    const store = setInitialState({});
    renderComponent({ store });

    await triggerNew();
    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    const { assetFactory } = store.get(modelFactoriesAtom);
    expect(assetFactory.createPipe({}).roughness).toBeNull();
  });

  const triggerNew = async () => {
    await userEvent.click(screen.getByRole("button", { name: "createNew" }));
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  };

  const TestableComponent = () => {
    const createNew = useNewProject();

    return (
      <button
        aria-label="createNew"
        onClick={() => createNew({ source: "test" })}
      >
        Create new
      </button>
    );
  };

  const renderComponent = ({ store }: { store: Store }) => {
    render(
      <CommandContainer store={store}>
        <TestableComponent />
      </CommandContainer>,
    );
  };
});

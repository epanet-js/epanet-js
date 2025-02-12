import { QueryClient, QueryClientProvider } from "react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PersistenceContext } from "src/lib/persistence/context";
import { MemPersistence } from "src/lib/persistence/memory";
import { Dialogs } from "src/components/dialogs";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import userEvent from "@testing-library/user-event";
import {
  FileInfo,
  Sel,
  SimulationState,
  Store,
  dataAtom,
  fileInfoAtom,
  momentLogAtom,
  nullData,
  simulationAtom,
} from "src/state/jotai";
import { HydraulicModel } from "src/hydraulic-model";
import { MomentLog } from "src/lib/persistence/moment-log";
import { UIDMap } from "src/lib/id_mapper";
import { fMoment } from "../lib/persistence/moment";
import { useNewProject } from "./create-new-project";

const aMoment = (name: string) => {
  return fMoment(name);
};

describe("create new project", () => {
  it("allows to choose the unit system", async () => {
    const store = setInitialState({});

    renderComponent({ store });

    await triggerNew();

    await userEvent.click(screen.getByRole("combobox", { name: /units/i }));
    await userEvent.click(screen.getByRole("option", { name: /GPM/ }));

    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.units.flow).toEqual("gal/min");
  });

  it("erases the previous state", async () => {
    const momentLogWithChanges = new MomentLog();
    momentLogWithChanges.append(aMoment("A"), aMoment("B"));

    const previousFileInfo: FileInfo = {
      name: "previous-file",
      modelVersion: "PREV",
      options: { type: "inp", folderId: null },
    };

    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().aJunction("J1").build(),
      momentLog: momentLogWithChanges,
      fileInfo: previousFileInfo,
    });

    renderComponent({ store });

    await triggerNew();

    await userEvent.click(screen.getByRole("button", { name: /discard/i }));

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.assets.size).toEqual(0);
    expect(hydraulicModel.units.flow).toEqual("l/s");

    const momentLog = store.get(momentLogAtom);
    expect(momentLog.getDeltas().length).toEqual(0);

    const fileInfo = store.get(fileInfoAtom);
    expect(fileInfo).toBeNull();
  });

  it("preseves state when canceled", async () => {
    const momentLogWithChanges = new MomentLog();
    momentLogWithChanges.append(aMoment("A"), aMoment("B"));

    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().aJunction("J1").build(),
      momentLog: momentLogWithChanges,
    });
    renderComponent({ store });

    await triggerNew();

    await userEvent.click(screen.getByRole("button", { name: /discard/i }));

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.assets.get("J1")).not.toBeUndefined();
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
      <button aria-label="createNew" onClick={createNew}>
        Create new
      </button>
    );
  };

  const renderComponent = ({ store }: { store: Store }) => {
    const idMap = UIDMap.empty();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <JotaiProvider store={store}>
          <PersistenceContext.Provider value={new MemPersistence(idMap, store)}>
            <Dialogs></Dialogs>
            <TestableComponent />
          </PersistenceContext.Provider>
        </JotaiProvider>
      </QueryClientProvider>,
    );
  };

  const setInitialState = ({
    store = createStore(),
    hydraulicModel = HydraulicModelBuilder.with().build(),
    momentLog = new MomentLog(),
    simulation = { status: "idle" },
    selection = { type: "none" },
    fileInfo = null,
  }: {
    store?: Store;
    hydraulicModel?: HydraulicModel;
    momentLog?: MomentLog;
    simulation?: SimulationState;
    selection?: Sel;
    fileInfo?: FileInfo | null;
  }): Store => {
    store.set(dataAtom, {
      ...nullData,
      selection,
      hydraulicModel: hydraulicModel,
    });
    store.set(momentLogAtom, momentLog);
    store.set(simulationAtom, simulation);
    store.set(fileInfoAtom, fileInfo);
    return store;
  };
});

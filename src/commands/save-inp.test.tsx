import { QueryClient, QueryClientProvider } from "react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { PersistenceContext } from "src/lib/persistence/context";
import { MemPersistence } from "src/lib/persistence/memory";
import { Dialogs } from "src/components/dialogs";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
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
import userEvent from "@testing-library/user-event";
import { useSaveInp } from "src/hooks/use-save-inp";

vi.mock("browser-fs-access", () => ({
  supported: true,
  fileSave: vi.fn(() => Promise.resolve("TEST_HANDLE")),
}));

import { fileSave } from "browser-fs-access";
import { Mock, vi } from "vitest";
import Notifications from "src/components/notifications";

describe("save inp", () => {
  it("serializes the model into an inp representation", async () => {
    const hydraulicModel = HydraulicModelBuilder.with().aJunction("J1").build();
    const store = setInitialState({
      hydraulicModel,
    });

    renderComponent({ store });

    await triggerSave();

    expect(fileSave).toHaveBeenCalled();
    const [inpBlob, fileSpec] = (fileSave as Mock).mock.lastCall as any[];
    expect(await inpBlob.text()).toContain("J1");
    expect(fileSpec).toEqual({
      fileName: "my-network.inp",
      extensions: [".inp"],
      description: ".INP",
      mimeTypes: ["text/plain"],
    });

    const fileInfo = store.get(fileInfoAtom);
    expect(fileInfo).toEqual({
      modelVersion: hydraulicModel.version,
      name: undefined,
      handle: "TEST_HANDLE",
      options: { type: "inp", folderId: "" },
    });

    expect(screen.getByText(/saved/i)).toBeInTheDocument();
  });

  const triggerSave = async () => {
    await userEvent.click(screen.getByRole("button", { name: "saveInp" }));
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  };

  const TestableComponent = () => {
    const saveInp = useSaveInp();

    return (
      <button aria-label="saveInp" onClick={() => saveInp()}>
        Save inp
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
            <Notifications />
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

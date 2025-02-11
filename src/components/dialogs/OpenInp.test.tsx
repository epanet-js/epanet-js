import { screen, render, waitFor } from "@testing-library/react";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Provider as JotaiProvider, createStore } from "jotai";
import {
  Sel,
  SimulationFailure,
  SimulationState,
  Store,
  dataAtom,
  momentLogAtom,
  nullData,
  simulationAtom,
} from "src/state/jotai";
import { HydraulicModel, Junction } from "src/hydraulic-model";
import { OpenInpDialogState } from "src/state/dialog_state";
import { UIDMap } from "src/lib/id_mapper";
import { PersistenceContext } from "src/lib/persistence/context";
import { MemPersistence } from "src/lib/persistence/memory";
import { OpenInpDialog } from "./OpenInp";
import { Dialog } from "@radix-ui/react-dialog";
import userEvent from "@testing-library/user-event";
import { aTestFile } from "src/__helpers__/file";
import { MomentLog } from "src/lib/persistence/moment-log";

describe("OpenInpDialog", () => {
  it("initializes state from a given inp", async () => {
    const inp = `
    [JUNCTIONS]
    J1\t10
    `;

    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.empty(),
    });
    const onClose = vi.fn();
    const file = aTestFile({ filename: "my-network.inp", content: inp });

    renderComponent({ store, file, onClose });

    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    const { hydraulicModel } = store.get(dataAtom);
    const junction = hydraulicModel.assets.get("J1");
    expect((junction as Junction).elevation).toEqual(10);
  });

  it("displays error when cannot process", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.empty(),
    });
    const onClose = vi.fn();
    const file = aTestFile({ content: "INVALID" });

    renderComponent({ store, file, onClose });

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );

    expect(onClose).not.toHaveBeenCalled();

    expect(screen.getByText(/error/i)).toBeInTheDocument();
    await userEvent.click(screen.getByText(/understood/i));

    expect(onClose).toHaveBeenCalled();
  });

  it("resets state when importing again", async () => {
    const inp = `
    [JUNCTIONS]
    J1\t10
    `;
    const previousSimulation: SimulationFailure = {
      status: "failure",
      report: "ERROR",
      modelVersion: "10",
    };
    const previousSelection: Sel = {
      type: "single",
      id: "ANY",
      parts: [],
    };
    const previousMomentLog = new MomentLog();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.empty(),
      momentLog: previousMomentLog,
      simulation: previousSimulation,
      selection: previousSelection,
    });
    const onClose = vi.fn();
    const file = aTestFile({ filename: "my-network.inp", content: inp });

    renderComponent({ store, file, onClose });

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const { hydraulicModel, selection } = store.get(dataAtom);
    expect(hydraulicModel.assets.get("J1")).toBeTruthy();
    expect(hydraulicModel.assets.get("P1")).toBeFalsy();

    const updatedMomentLog = store.get(momentLogAtom);
    expect(updatedMomentLog.id).not.toEqual(previousMomentLog.id);

    const simulation = store.get(simulationAtom);
    expect(simulation.status).toEqual("idle");

    expect(selection.type).toEqual("none");
  });

  const renderComponent = ({
    store,
    file = new File(["content"], "anyname"),
    onClose = () => {},
  }: {
    store: Store;
    file?: File;
    onClose?: () => void;
  }) => {
    const idMap = UIDMap.empty();
    const modalState: OpenInpDialogState = {
      type: "openInp",
      file: file,
    };
    render(
      <JotaiProvider store={store}>
        <PersistenceContext.Provider value={new MemPersistence(idMap, store)}>
          <Dialog>
            <OpenInpDialog modal={modalState} onClose={onClose} />
          </Dialog>
        </PersistenceContext.Provider>
      </JotaiProvider>,
    );
  };

  const setInitialState = ({
    store = createStore(),
    hydraulicModel = HydraulicModelBuilder.with().build(),
    momentLog = new MomentLog(),
    simulation = { status: "idle" },
    selection = { type: "none" },
  }: {
    store?: Store;
    hydraulicModel?: HydraulicModel;
    momentLog?: MomentLog;
    simulation?: SimulationState;
    selection?: Sel;
  }): Store => {
    store.set(dataAtom, {
      ...nullData,
      selection,
      hydraulicModel: hydraulicModel,
    });
    store.set(momentLogAtom, momentLog);
    store.set(simulationAtom, simulation);
    return store;
  };
});

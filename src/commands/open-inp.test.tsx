import { render, screen, waitFor } from "@testing-library/react";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  Sel,
  SimulationFailure,
  Store,
  dataAtom,
  fileInfoAtom,
  momentLogAtom,
  simulationAtom,
} from "src/state/jotai";
import { Junction } from "src/hydraulic-model";
import { MomentLog } from "src/lib/persistence/moment-log";
import userEvent from "@testing-library/user-event";
import { aTestFile } from "src/__helpers__/file";
import { fMoment } from "src/lib/persistence/moment";
import { useOpenInp } from "./open-inp";
import { aFileInfo, setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import {
  buildFileSystemHandleMock,
  lastSaveCall,
  stubFileOpen,
  stubFileSave,
} from "src/__helpers__/browser-fs-mock";

const aMoment = (name: string) => {
  return fMoment(name);
};

describe("open inp", () => {
  describe("openInpFromFs", () => {
    it("initializes state opening an inp from fs", async () => {
      const newHandle = stubFileOpen();
      const inp = `
    [JUNCTIONS]
    J1\t10
    `;
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.empty(),
      });
      const file = aTestFile({ filename: "my-network.inp", content: inp });

      renderComponent({ store });

      await triggerOpenFromFs();

      await doFileSelection(file);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const { hydraulicModel } = store.get(dataAtom);
      const junction = hydraulicModel.assets.get("J1");
      expect((junction as Junction).elevation).toEqual(10);

      expect(store.get(fileInfoAtom)!.handle).toEqual(newHandle);
    });

    it("displays error when cannot process", async () => {
      stubFileOpen();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.empty(),
      });
      const file = aTestFile({ content: "INVALID" });

      renderComponent({ store });

      await triggerOpenFromFs();

      await doFileSelection(file);

      await waitFor(() =>
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
      );

      expect(screen.getByText(/error/i)).toBeInTheDocument();
      await userEvent.click(screen.getByText(/understood/i));

      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });

    it("removes previous state", async () => {
      const newHandle = stubFileOpen();
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
        fileInfo: aFileInfo({
          handle: buildFileSystemHandleMock({ fileName: "old.inp" }),
        }),
      });
      const file = aTestFile({ filename: "my-network.inp", content: inp });

      renderComponent({ store });
      await triggerOpenFromFs();

      await waitFor(() =>
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
      );
      await userEvent.click(screen.getByRole("button", { name: /discard/i }));
      await waitFor(() =>
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
      );
      await doFileSelection(file);

      await waitFor(() =>
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
      );

      const { hydraulicModel, selection } = store.get(dataAtom);
      expect(hydraulicModel.assets.get("J1")).toBeTruthy();
      expect(hydraulicModel.assets.get("P1")).toBeFalsy();

      const updatedMomentLog = store.get(momentLogAtom);
      expect(updatedMomentLog.id).not.toEqual(previousMomentLog.id);

      const simulation = store.get(simulationAtom);
      expect(simulation.status).toEqual("idle");

      expect(selection.type).toEqual("none");

      expect(store.get(fileInfoAtom)!.handle).toEqual(newHandle);
    });

    it("can save previous changes before opening", async () => {
      const newHandle = stubFileOpen();
      stubFileSave();
      const inp = `
    [JUNCTIONS]
    J1\t10
    `;
      const momentLogWithChanges = new MomentLog();
      momentLogWithChanges.append(aMoment("A"), aMoment("B"));
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().aJunction("J1").build(),
        momentLog: momentLogWithChanges,
      });
      const file = aTestFile({ filename: "my-network.inp", content: inp });

      renderComponent({ store });

      await triggerOpenFromFs();

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      expect(screen.getByText(/unsaved/i)).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole("button", { name: /save and continue/i }),
      );

      const lastSave = lastSaveCall();

      expect(await lastSave.contentBlob.text()).toContain("J1");

      await waitFor(() =>
        expect(screen.queryByText(/unsaved/i)).not.toBeInTheDocument(),
      );
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      await doFileSelection(file);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const { hydraulicModel } = store.get(dataAtom);
      const junction = hydraulicModel.assets.get("J1");
      expect((junction as Junction).elevation).toEqual(10);

      expect(store.get(fileInfoAtom)!.handle).toEqual(newHandle);
    });

    it("can discard changes when opening a new project", async () => {
      const inp = `
    [JUNCTIONS]
    J1\t10
    `;
      const momentLogWithChanges = new MomentLog();
      momentLogWithChanges.append(aMoment("A"), aMoment("B"));
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.empty(),
        momentLog: momentLogWithChanges,
      });
      const file = aTestFile({ filename: "my-network.inp", content: inp });

      renderComponent({ store });

      await triggerOpenFromFs();

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      expect(screen.getByText(/unsaved/i)).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: /discard/i }));

      await waitFor(() =>
        expect(screen.queryByText(/unsaved/i)).not.toBeInTheDocument(),
      );
      await doFileSelection(file);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const { hydraulicModel } = store.get(dataAtom);
      const junction = hydraulicModel.assets.get("J1");
      expect((junction as Junction).elevation).toEqual(10);
    });
  });

  const triggerOpenFromFs = async () => {
    await userEvent.click(
      screen.getByRole("button", { name: "openInpFromFs" }),
    );
  };

  const doFileSelection = async (file: File) => {
    await userEvent.upload(screen.getByTestId("file-upload"), file);
  };

  const TestableComponent = () => {
    const { openInpFromFs } = useOpenInp();

    return (
      <button aria-label="openInpFromFs" onClick={openInpFromFs}>
        Open from fs
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

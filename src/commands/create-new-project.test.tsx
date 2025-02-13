import { render, screen, waitFor } from "@testing-library/react";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import userEvent from "@testing-library/user-event";
import {
  FileInfo,
  Store,
  dataAtom,
  fileInfoAtom,
  momentLogAtom,
} from "src/state/jotai";
import { MomentLog } from "src/lib/persistence/moment-log";
import { fMoment } from "../lib/persistence/moment";
import { useNewProject } from "./create-new-project";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import { stubFeatureOn } from "src/__helpers__/feature-flags";

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

  it("allows to chooose the headloss formula", async () => {
    stubFeatureOn("FLAG_HEADLOSS");
    const store = setInitialState({});

    renderComponent({ store });

    await triggerNew();

    await userEvent.click(screen.getByRole("combobox", { name: /headloss/i }));
    await userEvent.click(screen.getByRole("option", { name: /D-W/ }));

    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    const { hydraulicModel } = store.get(dataAtom);
    expect(hydraulicModel.headlossFormula).toEqual("D-W");
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
    render(
      <CommandContainer store={store}>
        <TestableComponent />
      </CommandContainer>,
    );
  };
});

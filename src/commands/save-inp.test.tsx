import { render, screen, waitFor } from "@testing-library/react";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Store, fileInfoAtom } from "src/state/jotai";
import userEvent from "@testing-library/user-event";

import "src/__helpers__/fs-mock";
import { useSaveInp } from "./save-inp";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import {
  buildFileSystemHandleMock,
  lastSaveCall,
  stubFileSave,
  stubFileSaveError,
} from "src/__helpers__/browser-fs-mock";

describe("save inp", () => {
  it("serializes the model into an inp representation", async () => {
    const newHandle = stubFileSave({ fileName: "my-network.inp" });
    const hydraulicModel = HydraulicModelBuilder.with().aJunction("J1").build();
    const store = setInitialState({
      hydraulicModel,
    });

    renderComponent({ store });

    await triggerSave();

    const lastSave = lastSaveCall();
    expect(await lastSave.contentBlob.text()).toContain("J1");
    expect(lastSave.options).toEqual({
      fileName: "my-network.inp",
      extensions: [".inp"],
      description: ".INP",
      mimeTypes: ["text/plain"],
    });
    expect(lastSave.handle).toEqual(null);

    const fileInfo = store.get(fileInfoAtom);
    expect(fileInfo).toEqual({
      modelVersion: hydraulicModel.version,
      name: "my-network.inp",
      handle: newHandle,
      options: { type: "inp", folderId: "" },
    });

    expect(screen.getByText(/saved/i)).toBeInTheDocument();
  });

  it("reuses previous file handle when available", async () => {
    const oldHandle = buildFileSystemHandleMock();
    const newHandle = stubFileSave();
    const store = setInitialState({
      fileInfo: {
        modelVersion: "ANY",
        name: "NAME",
        handle: oldHandle,
        options: { type: "inp", folderId: "" },
      },
    });

    renderComponent({ store });

    await triggerSave();

    const lastSave = lastSaveCall();
    const fileInfo = store.get(fileInfoAtom);
    expect(fileInfo).toEqual(
      expect.objectContaining({
        handle: newHandle,
      }),
    );
    expect(lastSave.handle).toEqual(oldHandle);
  });

  it("forces new handle when saving as", async () => {
    const oldHandle = buildFileSystemHandleMock();
    const newHandle = stubFileSave();
    const store = setInitialState({
      fileInfo: {
        modelVersion: "ANY",
        name: "NAME",
        handle: oldHandle,
        options: { type: "inp", folderId: "" },
      },
    });

    renderComponent({ store });

    await triggerSaveAs();

    const lastSave = lastSaveCall();
    const fileInfo = store.get(fileInfoAtom);
    expect(fileInfo).toEqual(
      expect.objectContaining({
        handle: newHandle,
      }),
    );
    expect(lastSave.handle).toBeNull();
  });

  it("displays an error when not saved", async () => {
    stubFileSaveError();
    const hydraulicModel = HydraulicModelBuilder.with().aJunction("J1").build();
    const store = setInitialState({
      hydraulicModel,
    });

    renderComponent({ store });
    await triggerSave();

    expect(screen.getByText(/canceled saving/i)).toBeInTheDocument();
  });

  const triggerSave = async () => {
    await userEvent.click(screen.getByRole("button", { name: "saveInp" }));
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  };

  const triggerSaveAs = async () => {
    await userEvent.click(screen.getByRole("button", { name: "saveAs" }));
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  };

  const TestableComponent = () => {
    const saveInp = useSaveInp();

    return (
      <>
        <button aria-label="saveInp" onClick={() => saveInp()}>
          Save inp
        </button>
        <button aria-label="saveAs" onClick={() => saveInp({ isSaveAs: true })}>
          Save as
        </button>
      </>
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

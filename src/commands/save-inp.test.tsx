import { render, screen, waitFor } from "@testing-library/react";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Store, fileInfoAtom } from "src/state/jotai";
import userEvent from "@testing-library/user-event";

vi.mock("browser-fs-access", () => ({
  supported: true,
  fileSave: vi.fn(),
}));

import { fileSave } from "browser-fs-access";
import { Mock, vi } from "vitest";
import { useSaveInp } from "./save-inp";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";

describe("save inp", () => {
  it("serializes the model into an inp representation", async () => {
    (fileSave as Mock).mockResolvedValue("NEW_HANDLE");
    const hydraulicModel = HydraulicModelBuilder.with().aJunction("J1").build();
    const store = setInitialState({
      hydraulicModel,
    });

    renderComponent({ store });

    await triggerSave();

    const [inpBlob, fileSpec, previousHandle] = (fileSave as Mock).mock
      .lastCall as any[];
    expect(await inpBlob.text()).toContain("J1");
    expect(fileSpec).toEqual({
      fileName: "my-network.inp",
      extensions: [".inp"],
      description: ".INP",
      mimeTypes: ["text/plain"],
    });
    expect(previousHandle).toEqual(null);

    const fileInfo = store.get(fileInfoAtom);
    expect(fileInfo).toEqual({
      modelVersion: hydraulicModel.version,
      name: undefined,
      handle: "NEW_HANDLE",
      options: { type: "inp", folderId: "" },
    });

    expect(screen.getByText(/saved/i)).toBeInTheDocument();
  });

  it("reuses previous file handle when available", async () => {
    (fileSave as Mock).mockResolvedValue("NEW_HANDLE");
    const store = setInitialState({
      fileInfo: {
        modelVersion: "ANY",
        name: "NAME",
        handle: "OLD_HANDLE" as unknown as FileSystemFileHandle,
        options: { type: "inp", folderId: "" },
      },
    });

    renderComponent({ store });

    await triggerSave();

    const [, , previousHandle] = (fileSave as Mock).mock.lastCall as any[];

    const fileInfo = store.get(fileInfoAtom);
    expect(fileInfo).toEqual(
      expect.objectContaining({
        handle: "NEW_HANDLE",
      }),
    );
    expect(previousHandle).toEqual("OLD_HANDLE");
  });

  it("forces new handle when saving as", async () => {
    (fileSave as Mock).mockResolvedValue("NEW_HANDLE");
    const store = setInitialState({
      fileInfo: {
        modelVersion: "ANY",
        name: "NAME",
        handle: "OLD_HANDLE" as unknown as FileSystemFileHandle,
        options: { type: "inp", folderId: "" },
      },
    });

    renderComponent({ store });

    await triggerSaveAs();

    const [, , previousHandle] = (fileSave as Mock).mock.lastCall as any[];

    const fileInfo = store.get(fileInfoAtom);
    expect(fileInfo).toEqual(
      expect.objectContaining({
        handle: "NEW_HANDLE",
      }),
    );
    expect(previousHandle).toBeNull();
  });

  it("displays an error when not saved", async () => {
    (fileSave as Mock).mockRejectedValue("BOOM");
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

import { render, screen, waitFor } from "@testing-library/react";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { inpFileInfoAtom } from "src/state/file-system";
import { Store } from "src/state";
import userEvent from "@testing-library/user-event";
import { useSaveInp } from "./save-inp";
import { aFileInfo, setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import { FileSystemHelpers } from "src/lib/export/file-system-helpers";
import { waitForNotLoading } from "src/__helpers__/ui-expects";

describe("save inp", () => {
  beforeEach(() => {
    vi.spyOn(FileSystemHelpers, "isFileSystemAccessSupported").mockReturnValue(
      true,
    );
    vi.spyOn(FileSystemHelpers, "triggerDownload").mockResolvedValue(undefined);
  });

  it("serializes the model into an inp representation", async () => {
    const IDS = { J1: 1 } as const;
    const { handle, chunks } = buildWritableHandleMock({
      fileName: "my-network.inp",
    });
    vi.spyOn(FileSystemHelpers, "openFileInFileSystem").mockResolvedValue(
      handle,
    );
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .build();
    const store = setInitialState({
      hydraulicModel,
    });

    renderComponent({ store });

    await triggerSave();

    expect(FileSystemHelpers.openFileInFileSystem).toHaveBeenCalledWith(
      "my-network.inp",
      ".INP",
      "text/plain",
      ".inp",
    );
    expect(chunks.join("")).toContain("J1");

    const fileInfo = store.get(inpFileInfoAtom);
    expect(fileInfo).toEqual({
      modelVersion: hydraulicModel.version,
      name: "my-network.inp",
      handle,
      options: { type: "inp" },
      isMadeByApp: true,
      isDemoNetwork: false,
    });

    expect(screen.getByText(/exported as inp/i)).toBeInTheDocument();
  });

  it("reuses previous file handle when available", async () => {
    const { handle: oldHandle } = buildWritableHandleMock({
      fileName: "NAME",
    });
    vi.spyOn(FileSystemHelpers, "openFileInFileSystem").mockResolvedValue(
      buildWritableHandleMock().handle,
    );
    const store = setInitialState({
      fileInfo: aFileInfo({
        modelVersion: "ANY",
        name: "NAME",
        handle: oldHandle,
        options: { type: "inp" },
        isMadeByApp: false,
      }),
    });

    renderComponent({ store });

    await triggerSave();
    await waitForNotLoading();

    expect(FileSystemHelpers.openFileInFileSystem).not.toHaveBeenCalled();
    expect(oldHandle.createWritable).toHaveBeenCalled();

    const fileInfo = store.get(inpFileInfoAtom);
    expect(fileInfo).toEqual(
      expect.objectContaining({
        handle: oldHandle,
      }),
    );
  });

  it("forces new handle when saving as", async () => {
    const { handle: oldHandle } = buildWritableHandleMock();
    const { handle: newHandle } = buildWritableHandleMock({
      fileName: "other.inp",
    });
    vi.spyOn(FileSystemHelpers, "openFileInFileSystem").mockResolvedValue(
      newHandle,
    );
    const store = setInitialState({
      fileInfo: aFileInfo({
        modelVersion: "ANY",
        name: "NAME",
        handle: oldHandle,
        options: { type: "inp" },
      }),
    });

    renderComponent({ store });

    await triggerSaveAs();

    expect(FileSystemHelpers.openFileInFileSystem).toHaveBeenCalled();
    expect(oldHandle.createWritable).not.toHaveBeenCalled();

    const fileInfo = store.get(inpFileInfoAtom);
    expect(fileInfo).toEqual(
      expect.objectContaining({
        handle: newHandle,
      }),
    );
  });

  it("writes to a temporary OPFS file and triggers a download when native FS is unavailable", async () => {
    const IDS = { J1: 1 } as const;
    vi.spyOn(FileSystemHelpers, "isFileSystemAccessSupported").mockReturnValue(
      false,
    );
    const { handle, chunks } = buildWritableHandleMock({
      fileName: "my-network.inp",
    });
    vi.spyOn(FileSystemHelpers, "openFileInOpfs").mockResolvedValue(handle);
    vi.spyOn(FileSystemHelpers, "openFileInFileSystem");
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .build();
    const store = setInitialState({
      hydraulicModel,
    });

    renderComponent({ store });

    await triggerSave();

    expect(FileSystemHelpers.openFileInOpfs).toHaveBeenCalledWith(
      "my-network.inp",
    );
    expect(FileSystemHelpers.openFileInFileSystem).not.toHaveBeenCalled();
    expect(chunks.join("")).toContain("J1");
    expect(FileSystemHelpers.triggerDownload).toHaveBeenCalledWith(
      "my-network.inp",
      handle,
    );
    expect(store.get(inpFileInfoAtom)).toBeNull();
    expect(screen.getByText(/exported as inp/i)).toBeInTheDocument();
  });

  it("displays an error when not saved", async () => {
    const IDS = { J1: 1 } as const;
    vi.spyOn(FileSystemHelpers, "openFileInFileSystem").mockRejectedValue(
      new Error("Something went wrong"),
    );
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .build();
    const store = setInitialState({
      hydraulicModel,
    });

    renderComponent({ store });
    await triggerSave();

    expect(screen.getByText(/canceled exporting inp/i)).toBeInTheDocument();
  });

  const buildWritableHandleMock = ({
    fileName = "mock.inp",
  }: { fileName?: string } = {}) => {
    const chunks: string[] = [];
    const handle = {
      name: fileName,
      kind: "file",
      createWritable: vi.fn(() =>
        Promise.resolve({
          write: vi.fn((chunk: string) => {
            chunks.push(chunk);
            return Promise.resolve();
          }),
          close: vi.fn(() => Promise.resolve()),
          abort: vi.fn(() => Promise.resolve()),
        } as unknown as FileSystemWritableFileStream),
      ),
    } as unknown as FileSystemFileHandle;
    return { handle, chunks };
  };

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
        <button
          aria-label="saveInp"
          onClick={() => saveInp({ source: "test" })}
        >
          Save inp
        </button>
        <button
          aria-label="saveAs"
          onClick={() => saveInp({ source: "test", isSaveAs: true })}
        >
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

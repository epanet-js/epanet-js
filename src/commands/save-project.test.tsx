import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Store } from "src/state";
import { fileInfoAtom } from "src/state/file-system";
import { projectSettingsAtom } from "src/state/project-settings";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import { lastSaveCall, stubFileSave } from "src/__helpers__/browser-fs-mock";
import { useSaveProject, projectExtension } from "./save-project";

const dbMock = vi.hoisted(() => {
  let settings: string | null = null;
  return {
    get: () => settings,
    set: (v: string | null) => {
      settings = v;
    },
    reset: () => {
      settings = null;
    },
  };
});

vi.mock("src/db", () => ({
  getDbWorker: () => ({
    newDb: () => {
      dbMock.set(null);
      return Promise.resolve();
    },
    openDb: () =>
      Promise.resolve({ status: "ok", fileVersion: 1, appVersion: 1 }),
    getProjectSettings: () => Promise.resolve(dbMock.get()),
    saveProjectSettings: (json: string) => {
      dbMock.set(json);
      return Promise.resolve();
    },
    exportDb: () =>
      Promise.resolve(
        new TextEncoder().encode(JSON.stringify({ settings: dbMock.get() })),
      ),
    closeDb: () => Promise.resolve(),
  }),
}));

beforeEach(() => {
  dbMock.reset();
});

describe("save project", () => {
  it("serializes projectSettings to a sqlite3 blob", async () => {
    const newHandle = stubFileSave({
      fileName: `my-project${projectExtension}`,
    });
    const store = setInitialState();

    renderComponent({ store });
    await triggerSave();

    const lastSave = lastSaveCall();
    expect(lastSave.options).toEqual({
      fileName: `my-project${projectExtension}`,
      extensions: [projectExtension],
      description: "EPANET project",
      mimeTypes: ["application/octet-stream"],
    });
    expect(lastSave.handle).toEqual(null);

    const fileInfo = store.get(fileInfoAtom);
    expect(fileInfo).toEqual(
      expect.objectContaining({
        name: newHandle.name,
        handle: newHandle,
        isMadeByApp: true,
        isDemoNetwork: false,
      }),
    );

    const payload = JSON.parse(await lastSave.contentBlob.text());
    const storedSettings = JSON.parse(payload.settings);
    expect(storedSettings).toEqual(store.get(projectSettingsAtom));
  });

  it("forces a new handle when saving as", async () => {
    const newHandle = stubFileSave({ fileName: `copy${projectExtension}` });
    const store = setInitialState();

    renderComponent({ store });
    await triggerSaveAs();

    const lastSave = lastSaveCall();
    expect(lastSave.handle).toBeNull();
    const fileInfo = store.get(fileInfoAtom);
    expect(fileInfo?.handle).toEqual(newHandle);
  });
});

const triggerSave = async () => {
  await userEvent.click(screen.getByRole("button", { name: "saveProject" }));
  await waitFor(() => {
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
};

const triggerSaveAs = async () => {
  await userEvent.click(screen.getByRole("button", { name: "saveProjectAs" }));
  await waitFor(() => {
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
};

const TestableComponent = () => {
  const saveProject = useSaveProject();
  return (
    <>
      <button
        aria-label="saveProject"
        onClick={() => saveProject({ source: "test" })}
      >
        Save project
      </button>
      <button
        aria-label="saveProjectAs"
        onClick={() => saveProject({ source: "test", isSaveAs: true })}
      >
        Save project as
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

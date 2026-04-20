import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Store } from "src/state";
import { fileInfoAtom } from "src/state/file-system";
import { projectSettingsAtom } from "src/state/project-settings";
import { stagingModelAtom } from "src/state/hydraulic-model";
import {
  ProjectSettings,
  defaultProjectSettings,
} from "src/lib/project-settings";
import { presets } from "src/lib/project-settings/quantities-spec";
import { aTestFile } from "src/__helpers__/file";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import { stubFileOpen } from "src/__helpers__/browser-fs-mock";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { useOpenProject } from "./open-project";
import { projectExtension } from "./save-project";

const TOO_NEW_MARKER = "__too_new__";

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
    newDb: () => Promise.resolve(),
    openDb: (bytes: Uint8Array) => {
      const text = new TextDecoder().decode(bytes);
      if (text === TOO_NEW_MARKER) {
        return Promise.resolve({
          status: "too-new",
          fileVersion: 99,
          appVersion: 1,
        });
      }
      try {
        const parsed = JSON.parse(text) as { settings: string | null };
        dbMock.set(parsed.settings);
      } catch {
        dbMock.set(null);
      }
      return Promise.resolve({
        status: "ok",
        fileVersion: 1,
        appVersion: 1,
      });
    },
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

describe("open project", () => {
  it("restores projectSettings and resets hydraulic model to defaults", async () => {
    const customSettings: ProjectSettings = {
      ...defaultProjectSettings,
      units: presets.GPM.units,
      defaults: presets.GPM.defaults,
      headlossFormula: "D-W",
      formatting: {
        decimals: presets.GPM.decimals,
        defaultDecimals: 2,
      },
    };
    const payload = JSON.stringify({
      settings: JSON.stringify(customSettings),
    });
    const handle = stubFileOpen();
    const file = aTestFile({
      filename: `saved${projectExtension}`,
      content: payload,
    });

    const IDS = { J1: 1 } as const;
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().aJunction(IDS.J1).build(),
    });

    renderComponent({ store });

    await triggerOpen();
    await doFileSelection(file);

    await waitFor(() => {
      const settings = store.get(projectSettingsAtom);
      expect(settings.headlossFormula).toEqual("D-W");
      expect(settings.units).toEqual(customSettings.units);
    });

    const hydraulicModel = store.get(stagingModelAtom);
    expect(hydraulicModel.assets.size).toEqual(0);

    const fileInfo = store.get(fileInfoAtom);
    expect(fileInfo?.name).toEqual(`saved${projectExtension}`);
    expect(fileInfo?.handle).toEqual(handle);
    expect(fileInfo?.isMadeByApp).toEqual(true);
  });

  it("warns when the file was written by a newer app version", async () => {
    stubFileOpen();
    const file = aTestFile({
      filename: `future${projectExtension}`,
      content: TOO_NEW_MARKER,
    });
    const store = setInitialState();

    renderComponent({ store });
    await triggerOpen();
    await doFileSelection(file);

    await waitFor(() => {
      expect(screen.getByText(/too new/i)).toBeInTheDocument();
    });
    expect(store.get(fileInfoAtom)).toBeNull();
  });
});

const triggerOpen = async () => {
  await userEvent.click(screen.getByRole("button", { name: "openProject" }));
};

const doFileSelection = async (file: File) => {
  await userEvent.upload(screen.getByTestId("file-upload"), file);
};

const TestableComponent = () => {
  const openProject = useOpenProject();
  return (
    <button
      aria-label="openProject"
      onClick={() => openProject({ source: "test" })}
    >
      Open project
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

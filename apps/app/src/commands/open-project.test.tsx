import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import {
  buildFileSystemHandleMock,
  stubFileOpen,
} from "src/__helpers__/browser-fs-mock";
import { fileOpen } from "browser-fs-access";
import { emptyNetworkData } from "@epanet-js/converters";
import { AuthMockProvider, aUser } from "src/__helpers__/auth-mock";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { stubProjectionsReady } from "src/__helpers__/projections";
import { stubConverter } from "src/lib/converters/__helpers__/stub-converter";
import { aTestFile } from "src/__helpers__/file";
import { getByLabel } from "src/__helpers__/asset-queries";
import { waitForNotLoading } from "src/__helpers__/ui-expects";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import * as db from "src/lib/db";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import type { HydraulicModel, Junction } from "src/hydraulic-model";
import { Store } from "src/state";
import type { FileWithHandle } from "browser-fs-access";
import { useOpenProject, useOpenProjectFile } from "./open-project";
import { recentFilesStoreAtom } from "src/state/file-system";

describe("openProjectFile", () => {
  useInProcessDb();

  beforeEach(() => {
    stubProjectionsReady();
  });

  it("adds the opened project to recent files", async () => {
    const hydraulicModel = HydraulicModelBuilder.with().aJunction(1).build();
    await seedDb(hydraulicModel);
    const blob = await db.exportDb();
    const handle = buildFileSystemHandleMock({ fileName: "my-project.ejsdb" });
    const file = Object.assign(
      new File([blob], "my-project.ejsdb", {
        type: "application/octet-stream",
      }),
      { handle },
    ) as FileWithHandle;

    const store = setInitialState({ hydraulicModel });

    renderComponent({ store, file });
    await triggerOpen();

    await waitFor(async () => {
      const entries = await store.get(recentFilesStoreAtom).getAll();
      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe("my-project.ejsdb");
      expect(entries[0].handle).toBe(handle);
    });
  });
});

const seedDb = async (hydraulicModel: HydraulicModel) => {
  await db.importProject({
    newDb: true,
    hydraulicModel,
    projectSettings: defaultProjectSettings,
    simulationSettings: defaultSimulationSettings,
  });
};

const triggerOpen = async () => {
  await userEvent.click(screen.getByRole("button", { name: "openProject" }));
  await waitFor(() => {
    expect(screen.queryByText(/opening project/i)).not.toBeInTheDocument();
  });
};

const TestableComponent = ({ file }: { file: FileWithHandle }) => {
  const openProjectFile = useOpenProjectFile();

  return (
    <button
      aria-label="openProject"
      onClick={() => void openProjectFile(file, "test")}
    >
      Open project
    </button>
  );
};

const renderComponent = ({
  store,
  file,
}: {
  store: Store;
  file: FileWithHandle;
}) => {
  render(
    <CommandContainer store={store}>
      <TestableComponent file={file} />
    </CommandContainer>,
  );
};

describe("openProject", () => {
  useInProcessDb();

  beforeEach(() => {
    stubProjectionsReady();
  });

  it("offers the registered converter formats in the picker", async () => {
    stubFeatureOn("FLAG_SYNERGI");
    stubFileOpen();
    stubConverter(
      "synergi",
      { network: emptyNetworkData(), issues: [] },
      { name: "Synergi", extensions: [".mdb"] },
    );
    const store = setInitialState();

    renderPicker({ store });
    await triggerOpenProject();
    await doFileSelection(aTestFile({ filename: "my-network.mdb" }));

    await waitForNotLoading();

    expect(fileOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        extensions: [".ejsdb", ".inp", ".mdb"],
        description: "Project, EPANET INP or Synergi",
      }),
    );
  });

  it("builds the model when the picked file belongs to a converter", async () => {
    stubFeatureOn("FLAG_SYNERGI");
    stubFileOpen();
    stubConverter(
      "synergi",
      {
        network: {
          ...emptyNetworkData(),
          junctions: [
            { ref: "1", label: "J1", coordinates: [0, 0], elevation: 63 },
          ],
        },
        issues: [],
      },
      { name: "Synergi", extensions: [".mdb"] },
    );
    const store = setInitialState();

    renderPicker({ store });
    await triggerOpenProject();
    await doFileSelection(aTestFile({ filename: "my-network.mdb" }));

    await waitForNotLoading();

    const hydraulicModel = store.get(stagingModelDerivedAtom);
    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    expect(junction.elevation).toEqual(63);
    expect(store.get(projectSettingsAtom).name).toEqual("my-network");
  });

  it("keeps the picker to projects and INPs when no converter is available", async () => {
    stubFeatureOff("FLAG_SYNERGI");
    stubFileOpen();
    stubConverter(
      "synergi",
      { network: emptyNetworkData(), issues: [] },
      { name: "Synergi", extensions: [".mdb"] },
    );
    const store = setInitialState();

    renderPicker({ store });
    await triggerOpenProject();
    await doFileSelection(aTestFile({ filename: "my-network.mdb" }));

    await waitForNotLoading();

    expect(fileOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        extensions: [".ejsdb", ".inp"],
        description: "Project or EPANET INP",
      }),
    );
    expect(screen.getByText(/failed to open model/i)).toBeInTheDocument();
  });
});

const triggerOpenProject = async () => {
  await userEvent.click(
    screen.getByRole("button", { name: "openProjectPicker" }),
  );
};

const doFileSelection = async (file: File) => {
  await userEvent.upload(screen.getByTestId("file-upload"), file);
};

const PickerComponent = () => {
  const openProject = useOpenProject();

  return (
    <button
      aria-label="openProjectPicker"
      onClick={() => openProject({ source: "toolbar" })}
    >
      Open project
    </button>
  );
};

const renderPicker = ({ store }: { store: Store }) => {
  render(
    <AuthMockProvider user={aUser({ plan: "pro" })}>
      <CommandContainer store={store}>
        <PickerComponent />
      </CommandContainer>
    </AuthMockProvider>,
  );
};

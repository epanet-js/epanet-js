import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import { buildFileSystemHandleMock } from "src/__helpers__/browser-fs-mock";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import * as db from "src/lib/db";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { defaultProjectSettings } from "src/lib/project-settings";
import type { HydraulicModel } from "src/hydraulic-model";
import { Store } from "src/state";
import type { FileWithHandle } from "browser-fs-access";
import { useOpenProjectFile } from "./open-project";
import { recentFilesStoreAtom } from "src/state/file-system";

describe("openProjectFile", () => {
  useInProcessDb();

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

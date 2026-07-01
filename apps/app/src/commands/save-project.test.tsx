import { render, screen, waitFor } from "@testing-library/react";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { projectFileInfoAtom } from "src/state/file-system";
import { Store } from "src/state";
import userEvent from "@testing-library/user-event";
import { useSaveProject } from "./save-project";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import {
  buildFileSystemHandleMock,
  stubFileSave,
  stubFileSaveAbort,
  stubFileSaveError,
  stubFileSavePermissionDenied,
} from "src/__helpers__/browser-fs-mock";
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";
import * as errorTracking from "src/infra/error-tracking";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import * as db from "src/lib/db";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import type { HydraulicModel } from "src/hydraulic-model";
import { userSettingsAtom } from "src/state/user-settings";
import { Mock } from "vitest";

const seedDb = async (hydraulicModel: HydraulicModel) => {
  await db.importProject({
    newDb: true,
    hydraulicModel,
    simulationSettings: defaultSimulationSettings,
  });
};

const skipProjectSavedInfo = (store: Store) => {
  store.set(userSettingsAtom, {
    showFirstScenarioDialog: true,
    showProjectSavedInfo: false,
    showFileFormatUpdated: true,
    showFilePermissionsInfo: true,
  });
};

describe("save project", () => {
  useInProcessDb();

  it("writes the project and shows a success notification", async () => {
    const newHandle = stubFileSave({ fileName: "my-project.ejsdb" });
    const hydraulicModel = HydraulicModelBuilder.with().aJunction(1).build();
    const store = setInitialState({ hydraulicModel });
    skipProjectSavedInfo(store);
    await seedDb(hydraulicModel);

    renderComponent({ store });
    await triggerSave();

    expect(screen.getByText(/^saved$/i)).toBeInTheDocument();
    expect(store.get(projectFileInfoAtom)?.handle).toBe(newHandle);
  });

  it("shows the cancel warning when the user dismisses the save dialog", async () => {
    stubFileSaveAbort();
    const hydraulicModel = HydraulicModelBuilder.with().aJunction(1).build();
    const store = setInitialState({ hydraulicModel });
    skipProjectSavedInfo(store);
    await seedDb(hydraulicModel);

    renderComponent({ store });
    await triggerSave();

    expect(screen.getByText(/canceled saving/i)).toBeInTheDocument();
    expect(store.get(projectFileInfoAtom)).toBeNull();
  });

  it("shows an error notification when persistence fails", async () => {
    stubFileSave({ fileName: "my-project.ejsdb" });
    const hydraulicModel = HydraulicModelBuilder.with().aJunction(1).build();
    const store = setInitialState({ hydraulicModel });
    skipProjectSavedInfo(store);
    await seedDb(hydraulicModel);
    const failure = new Error("Project settings: data does not match schema");
    const spy = vi
      .spyOn(db, "saveProjectSettings")
      .mockRejectedValueOnce(failure);

    renderComponent({ store });
    await triggerSave();

    expect(screen.getByText(/couldn't save project/i)).toBeInTheDocument();
    expect(
      screen.getByText(/if the error persists, contact support/i),
    ).toBeInTheDocument();
    expect(store.get(projectFileInfoAtom)).toBeNull();

    spy.mockRestore();
  });

  it("notifies and does not report to Sentry when write permission is denied", async () => {
    stubFileSavePermissionDenied();
    const hydraulicModel = HydraulicModelBuilder.with().aJunction(1).build();
    const store = setInitialState({ hydraulicModel });
    skipProjectSavedInfo(store);
    await seedDb(hydraulicModel);
    const captureSpy = vi
      .spyOn(errorTracking, "captureError")
      .mockImplementation(() => {});

    renderComponent({ store });
    await triggerSave();

    expect(screen.getByText(/permission to write/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/couldn't save project/i),
    ).not.toBeInTheDocument();
    expect(captureSpy).not.toHaveBeenCalled();
    expect(store.get(projectFileInfoAtom)).toBeNull();

    captureSpy.mockRestore();
  });

  it("treats a non-abort fileSave rejection as an error, not a cancel", async () => {
    stubFileSaveError();
    const hydraulicModel = HydraulicModelBuilder.with().aJunction(1).build();
    const store = setInitialState({ hydraulicModel });
    skipProjectSavedInfo(store);
    await seedDb(hydraulicModel);

    renderComponent({ store });
    await triggerSave();

    expect(screen.getByText(/couldn't save project/i)).toBeInTheDocument();
    expect(screen.queryByText(/canceled saving/i)).not.toBeInTheDocument();
  });

  describe("with FLAG_FILE_PERMISSIONS on", () => {
    it("shows the write info dialog and defers saving until acknowledged", async () => {
      stubFeatureOn("FLAG_FILE_PERMISSIONS");
      const savedHandle = stubFileSave({ fileName: "my-project.ejsdb" });
      const hydraulicModel = HydraulicModelBuilder.with().aJunction(1).build();
      const store = setInitialState({ hydraulicModel });
      await seedDb(hydraulicModel);
      seedProjectInfo(store, hydraulicModel, aProjectHandle("prompt"));

      renderComponent({ store });
      await clickSave();

      await waitFor(() => {
        expect(screen.getByText(/grant permission to save/i)).toBeVisible();
      });
      expect(screen.queryByText(/^saved$/i)).not.toBeInTheDocument();

      await userEvent.click(
        screen.getByRole("button", { name: /understood/i }),
      );

      await waitFor(() => {
        expect(screen.getByText(/^saved$/i)).toBeInTheDocument();
      });
      expect(store.get(projectFileInfoAtom)?.handle).toBe(savedHandle);
    });

    it("saves directly without the dialog when write permission is granted", async () => {
      stubFeatureOn("FLAG_FILE_PERMISSIONS");
      stubFileSave({ fileName: "my-project.ejsdb" });
      const hydraulicModel = HydraulicModelBuilder.with().aJunction(1).build();
      const store = setInitialState({ hydraulicModel });
      await seedDb(hydraulicModel);
      seedProjectInfo(store, hydraulicModel, aProjectHandle("granted"));

      renderComponent({ store });
      await triggerSave();

      expect(screen.getByText(/^saved$/i)).toBeInTheDocument();
      expect(screen.queryByText(/grant permission to save/i)).toBeNull();
    });

    it("stops showing the dialog when the user opts out via the checkbox", async () => {
      stubFeatureOn("FLAG_FILE_PERMISSIONS");
      stubFileSave({ fileName: "my-project.ejsdb" });
      const hydraulicModel = HydraulicModelBuilder.with().aJunction(1).build();
      const store = setInitialState({ hydraulicModel });
      await seedDb(hydraulicModel);
      seedProjectInfo(store, hydraulicModel, aProjectHandle("prompt"));

      renderComponent({ store });
      await clickSave();

      await waitFor(() => {
        expect(screen.getByText(/grant permission to save/i)).toBeVisible();
      });

      await userEvent.click(screen.getByRole("checkbox"));
      await userEvent.click(
        screen.getByRole("button", { name: /understood/i }),
      );

      await waitFor(() => {
        expect(store.get(userSettingsAtom).showFilePermissionsInfo).toBe(false);
      });
    });
  });

  it("does not show the write dialog when the flag is off", async () => {
    stubFeatureOff("FLAG_FILE_PERMISSIONS");
    stubFileSave({ fileName: "my-project.ejsdb" });
    const hydraulicModel = HydraulicModelBuilder.with().aJunction(1).build();
    const store = setInitialState({ hydraulicModel });
    await seedDb(hydraulicModel);
    seedProjectInfo(store, hydraulicModel, aProjectHandle("prompt"));

    renderComponent({ store });
    await triggerSave();

    expect(screen.getByText(/^saved$/i)).toBeInTheDocument();
    expect(screen.queryByText(/grant permission to save/i)).toBeNull();
  });

  const aProjectHandle = (queryState: PermissionState = "prompt") => {
    const handle = buildFileSystemHandleMock({ fileName: "my-project.ejsdb" });
    (handle.queryPermission as unknown as Mock).mockResolvedValue(queryState);
    return handle;
  };

  const seedProjectInfo = (
    store: Store,
    hydraulicModel: HydraulicModel,
    handle: FileSystemFileHandle,
  ) => {
    store.set(projectFileInfoAtom, {
      name: handle.name,
      modelVersion: hydraulicModel.version,
      handle,
    });
  };

  const clickSave = async () => {
    await userEvent.click(screen.getByRole("button", { name: "saveProject" }));
  };

  const triggerSave = async () => {
    await userEvent.click(screen.getByRole("button", { name: "saveProject" }));
    await waitFor(() => {
      expect(screen.queryByText(/saving project/i)).not.toBeInTheDocument();
    });
  };

  const TestableComponent = () => {
    const saveProject = useSaveProject();

    return (
      <button
        aria-label="saveProject"
        onClick={() => saveProject({ source: "test" })}
      >
        Save project
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

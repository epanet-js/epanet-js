import { useCallback, useContext } from "react";
import { FeatureCollection } from "geojson";
import { LngLatBoundsLike } from "mapbox-gl";
import type { FileWithHandle } from "browser-fs-access";

import { useFileOpen } from "src/hooks/use-file-open";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";
import {
  useOpenPersistedProject,
  type OpenPersistedProjectPhase,
} from "src/hooks/persistence/use-open-persisted-project";
import { useUserTracking } from "src/infra/user-tracking";
import { chooseUnitSystem } from "src/simulation/build-inp";
import type { Asset } from "src/hydraulic-model";
import { notify } from "src/components/notifications";
import { SuccessIcon, WarningIcon } from "src/icons";
import { captureError } from "src/infra/error-tracking";
import { formatErrorDetails } from "src/lib/errors";
import { useTranslate } from "src/hooks/use-translate";

import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useSetAtom } from "jotai";
import { inpFileInfoAtom, projectFileInfoAtom } from "src/state/file-system";
import { dialogAtom } from "src/state/dialog";
import { MapContext } from "src/map";
import { getExtent } from "src/lib/geometry";
import { projectExtension } from "./save-project";
import { inpExtension, useImportInp } from "./import-inp";

export const openProjectShortcut = "ctrl+o";

export const useOpenProjectFile = () => {
  const { openPersistedProject } = useOpenPersistedProject();
  const setInpFileInfo = useSetAtom(inpFileInfoAtom);
  const setProjectFileInfo = useSetAtom(projectFileInfoAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const map = useContext(MapContext);
  const translate = useTranslate();
  const userTracking = useUserTracking();

  return useCallback(
    async (file: FileWithHandle, source: string) => {
      try {
        setDialogState({ type: "openProjectProgress", phase: "opening" });

        const reportProgress = (phase: OpenPersistedProjectPhase) => {
          setDialogState({ type: "openProjectProgress", phase });
        };

        const result = await openPersistedProject({
          file,
          onProgress: reportProgress,
        });

        if (result.status !== "ok") {
          setDialogState(null);
          if (result.status === "too-new") {
            notify({
              variant: "warning",
              size: "md",
              title: "Project file is too new",
              description:
                "This file was created by a newer version of the app. Please update to open it.",
              details: `File version ${result.fileVersion}, app version ${result.appVersion}.`,
              Icon: WarningIcon,
            });
            userTracking.capture({
              name: "projectFile.openFailed",
              source,
              reason: "tooNew",
              fileVersion: result.fileVersion,
              appVersion: result.appVersion,
            });
            return;
          }
          if (result.status === "corrupt") {
            notify({
              variant: "warning",
              size: "md",
              title: "Project file is invalid",
              description:
                "The file couldn't be read as a project. It may be corrupt or saved in a different format.",
              details: result.errorDetails,
              Icon: WarningIcon,
            });
            captureError(
              new Error(`openProject corrupt: ${result.errorDetails}`),
            );
            userTracking.capture({
              name: "projectFile.openFailed",
              source,
              reason: "corrupt",
            });
            return;
          }
          if (result.status === "migration-failed") {
            notify({
              variant: "warning",
              size: "md",
              title: "Couldn't open project",
              description:
                "The project file couldn't be upgraded to this version of the app.",
              details: `File version ${result.fileVersion}, app version ${result.appVersion}.\n${result.errorDetails}`,
              Icon: WarningIcon,
            });
            captureError(
              new Error(
                `openProject migration-failed (v${result.fileVersion}→${result.appVersion}): ${result.errorDetails}`,
              ),
            );
            userTracking.capture({
              name: "projectFile.openFailed",
              source,
              reason: "migrationFailed",
              fileVersion: result.fileVersion,
              appVersion: result.appVersion,
            });
            return;
          }
          notify({
            variant: "warning",
            size: "md",
            title: "Couldn't open project",
            description: "Something went wrong while opening the file.",
            details: result.errorDetails,
            Icon: WarningIcon,
          });
          captureError(
            new Error(`openProject internal: ${result.errorDetails}`),
          );
          userTracking.capture({
            name: "projectFile.openFailed",
            source,
            reason: "internal",
          });
          return;
        }

        setProjectFileInfo({
          name: file.name,
          handle: file.handle,
          modelVersion: result.modelVersion,
        });
        setInpFileInfo(null);

        const features: FeatureCollection = {
          type: "FeatureCollection",
          features: [...result.hydraulicModel.assets.values()].map(
            (a) => a.feature,
          ),
        };
        getExtent(features).map((importedExtent) => {
          map?.map.fitBounds(importedExtent as LngLatBoundsLike, {
            padding: 100,
            duration: 0,
          });
        });

        setDialogState(null);
        notify({
          variant: "success",
          title: translate("opened"),
          Icon: SuccessIcon,
          size: "sm",
        });

        userTracking.capture({
          name: "projectFile.opened",
          source,
          counts: tallyAssetCounts(result.hydraulicModel.assets),
          headlossFormula: result.projectSettings.headlossFormula,
          units: chooseUnitSystem(result.projectSettings.units),
        });
      } catch (error) {
        setDialogState(null);
        captureError(error as Error);
        notify({
          variant: "warning",
          size: "md",
          title: "Couldn't open project",
          description: "Something went wrong while opening the file.",
          details: formatErrorDetails(error),
          Icon: WarningIcon,
        });
        userTracking.capture({
          name: "projectFile.openFailed",
          source,
          reason: "exception",
        });
      }
    },
    [
      openPersistedProject,
      setInpFileInfo,
      setProjectFileInfo,
      setDialogState,
      map,
      translate,
      userTracking,
    ],
  );
};

const tallyAssetCounts = (
  assets: Map<unknown, Asset>,
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const asset of assets.values()) {
    counts[asset.type] = (counts[asset.type] ?? 0) + 1;
  }
  return counts;
};

export const useOpenProject = () => {
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const { openFile, isReady } = useFileOpen();
  const openProjectFile = useOpenProjectFile();
  const importInp = useImportInp();
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");

  const openProject = useCallback(
    async ({ source }: { source: string }) => {
      userTracking.capture({ name: "openProject.started", source });

      if (!isOurFileOn) return;
      if (!isReady) throw new Error("FS not ready");

      const file = await openFile({
        multiple: false,
        extensions: [projectExtension, inpExtension],
        description: "Project or EPANET INP",
        mimeTypes: ["application/octet-stream"],
      });
      if (!file) return;

      if (file.name.toLowerCase().endsWith(inpExtension)) {
        void importInp([file], source);
        notify({
          variant: "success",
          title: translate("initializedProjectFromInp"),
          Icon: SuccessIcon,
          size: "sm",
        });
        return;
      }

      await openProjectFile(file, source);
    },
    [
      openFile,
      isReady,
      openProjectFile,
      importInp,
      userTracking,
      translate,
      isOurFileOn,
    ],
  );

  return useCallback(
    ({ source }: { source: string }) => {
      checkUnsavedChanges(() => openProject({ source }));
    },
    [checkUnsavedChanges, openProject],
  );
};

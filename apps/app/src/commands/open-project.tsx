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
import { captureError, captureWarning } from "src/infra/error-tracking";
import { formatErrorDetails } from "src/lib/errors";
import { useTranslate } from "src/hooks/use-translate";
import { useRecentFiles } from "src/hooks/use-recent-files";

import { useSetAtom } from "jotai";
import { inpFileInfoAtom, projectFileInfoAtom } from "src/state/file-system";
import { dialogAtom } from "src/state/dialog";
import { MapContext, captureThumbnail } from "src/map";
import { getExtent } from "@epanet-js/geometry";
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
  const { addRecent } = useRecentFiles();

  return useCallback(
    async (
      file: FileWithHandle,
      source: string,
      options: { isUnsaved?: boolean; lastSavedAt?: number } = {},
    ) => {
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
              new Error(
                `openProject corrupt (${file.name}): ${result.errorDetails}`,
              ),
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
                `openProject migration-failed (${file.name}, v${result.fileVersion}→${result.appVersion}): ${result.errorDetails}`,
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
            new Error(
              `openProject internal (${file.name}): ${result.errorDetails}`,
            ),
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
          isUnsaved: options.isUnsaved,
          lastSavedAt: options.isUnsaved
            ? options.lastSavedAt
            : file.lastModified,
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

        if (file.handle) {
          const handle = file.handle;
          const name = file.name;
          if (map) {
            const captureAndSave = () => {
              const thumbnail = captureThumbnail(map) ?? undefined;
              void addRecent(name, handle, thumbnail);
            };
            if (map.map.loaded() && !map.map.isMoving()) {
              captureAndSave();
            } else {
              const timeoutId = setTimeout(captureAndSave, 5000);
              map.map.once("idle", () => {
                clearTimeout(timeoutId);
                captureAndSave();
              });
            }
          } else {
            void addRecent(name, file.handle);
          }
        }

        setDialogState(null);
        notify({
          variant: "success",
          title: translate("projectOpened"),
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
        const err = error as Error;
        if (err.name === "NotFoundError" || err.name === "NotAllowedError") {
          throw err;
        }
        captureError(
          new Error(
            `openProject exception (${file.name}): ${formatErrorDetails(error)}`,
            { cause: error },
          ),
        );
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
      addRecent,
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
  const setDialogState = useSetAtom(dialogAtom);
  const translate = useTranslate();

  const openProject = useCallback(
    async ({ source }: { source: string }) => {
      userTracking.capture({ name: "openProject.started", source });

      if (!isReady) throw new Error("FS not ready");

      const file = await openFile({
        multiple: false,
        extensions: [projectExtension, inpExtension],
        description: "Project or EPANET INP",
        mimeTypes: ["application/octet-stream"],
      });
      if (!file) return;

      const name = file.name.toLowerCase();
      if (name.endsWith(inpExtension)) {
        void importInp([file], source);
        return;
      }

      if (!name.endsWith(projectExtension)) {
        setDialogState({ type: "invalidFilesError" });
        userTracking.capture({ name: "invalidFilesError.seen" });
        return;
      }

      try {
        await openProjectFile(file, source);
      } catch (error) {
        const err = error as Error;
        if (err.name === "NotAllowedError") {
          notify({
            variant: "warning",
            title: translate("recentFilePermissionDenied"),
          });
          captureWarning("Open project: permission denied", err);
          return;
        }
        if (err.name === "NotFoundError") {
          notify({
            variant: "warning",
            title: translate("recentFileNotFound"),
          });
          captureWarning("Open project: file not found", err);
          return;
        }
        throw err;
      }
    },
    [
      openFile,
      isReady,
      openProjectFile,
      importInp,
      userTracking,
      setDialogState,
      translate,
    ],
  );

  return useCallback(
    ({ source }: { source: string }) => {
      checkUnsavedChanges(() => openProject({ source }));
    },
    [checkUnsavedChanges, openProject],
  );
};

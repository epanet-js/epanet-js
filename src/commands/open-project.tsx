import { useCallback, useContext } from "react";
import { FeatureCollection } from "geojson";
import { LngLatBoundsLike } from "mapbox-gl";

import { useFileOpen } from "src/hooks/use-file-open";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";
import {
  useOpenPersistedProject,
  type OpenPersistedProjectPhase,
} from "src/hooks/persistence/use-open-persisted-project";
import { useUserTracking } from "src/infra/user-tracking";
import { notify } from "src/components/notifications";
import { SuccessIcon, WarningIcon } from "src/icons";
import { captureError } from "src/infra/error-tracking";
import { useTranslate } from "src/hooks/use-translate";

import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useSetAtom } from "jotai";
import { inpFileInfoAtom, projectFileInfoAtom } from "src/state/file-system";
import { dialogAtom } from "src/state/dialog";
import { MapContext } from "src/map";
import { getExtent } from "src/lib/geometry";
import { projectExtension } from "./save-project";

export const openProjectShortcut = "ctrl+o";

export const useOpenProject = () => {
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const { openFile, isReady } = useFileOpen();
  const { openPersistedProject } = useOpenPersistedProject();
  const setInpFileInfo = useSetAtom(inpFileInfoAtom);
  const setProjectFileInfo = useSetAtom(projectFileInfoAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const map = useContext(MapContext);
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");

  const openProject = useCallback(
    async ({ source }: { source: string }) => {
      userTracking.capture({ name: "openProject.started", source });

      if (!isOurFileOn) return;
      if (!isReady) throw new Error("FS not ready");

      try {
        const dbFile = await openFile({
          multiple: false,
          extensions: [projectExtension],
          description: "EPANET project",
          mimeTypes: ["application/octet-stream"],
        });
        if (!dbFile) return;

        setDialogState({ type: "openProjectProgress", phase: "opening" });

        const reportProgress = (phase: OpenPersistedProjectPhase) => {
          setDialogState({ type: "openProjectProgress", phase });
        };

        const result = await openPersistedProject({
          file: dbFile,
          onProgress: reportProgress,
        });

        if (result.status === "too-new") {
          setDialogState(null);
          notify({
            variant: "warning",
            size: "md",
            title: "Project file is too new",
            description:
              "This file was created by a newer version of the app. Please update to open it.",
            Icon: WarningIcon,
          });
          return;
        }

        setProjectFileInfo({
          name: dbFile.name,
          handle: dbFile.handle,
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
      } catch (error) {
        setDialogState(null);
        captureError(error as Error);
        notify({
          variant: "warning",
          size: "md",
          title: "Project file is invalid",
          Icon: WarningIcon,
        });
      }
    },
    [
      openFile,
      isReady,
      openPersistedProject,
      setInpFileInfo,
      setProjectFileInfo,
      setDialogState,
      map,
      translate,
      userTracking,
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

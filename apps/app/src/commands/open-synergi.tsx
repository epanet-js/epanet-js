import { useCallback, useContext } from "react";
import { useSetAtom } from "jotai";
import { FileWithHandle } from "browser-fs-access";
import { LngLatBoundsLike } from "mapbox-gl";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";
import { buildModel, getConverter } from "src/lib/converters";
import { dialogAtom } from "src/state/dialog";
import { inpFileInfoAtom, projectFileInfoAtom } from "src/state/file-system";
import { savedProjectRevisionAtom } from "src/state/project-revision";
import { captureError } from "src/infra/error-tracking";
import { handleError } from "src/infra/errors";
import { ImportSynergiStarted, useUserTracking } from "src/infra/user-tracking";
import { useFileOpen } from "src/hooks/use-file-open";
import { useProjections } from "src/hooks/use-projections";
import { useLabelMaxLength } from "src/hooks/use-label-max-length";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { buildDefaultSimulationSettings } from "src/simulation/simulation-settings";
import { useStartNewProject } from "src/hooks/persistence/use-start-new-project";
import { MapContext } from "src/map";

export const synergiExtension = ".mdb";

export const useOpenSynergi = () => {
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const userTracking = useUserTracking();
  const { openFile, isReady } = useFileOpen();
  const { projections } = useProjections();
  const labelMaxLength = useLabelMaxLength();
  const isReportYesOn = useFeatureFlag("FLAG_REPORT_YES");
  const { startNewProject } = useStartNewProject();
  const setDialogState = useSetAtom(dialogAtom);
  const setInpFileInfo = useSetAtom(inpFileInfoAtom);
  const setProjectFileInfo = useSetAtom(projectFileInfoAtom);
  const setSavedProjectRevision = useSetAtom(savedProjectRevisionAtom);
  const map = useContext(MapContext);

  const importSynergi = useCallback(
    async (file: FileWithHandle, source: string) => {
      const parse = getConverter("synergi");
      if (!parse || !projections) {
        setDialogState({ type: "invalidFilesError" });
        userTracking.capture({ name: "invalidFilesError.seen" });
        return;
      }

      setDialogState({ type: "loading" });

      try {
        const { network } = await parse({ files: [file] });
        const { hydraulicModel, factories, projectSettings, bounds } =
          buildModel(network, { projections, labelMaxLength });

        const started = await startNewProject({
          hydraulicModel,
          factories,
          projectSettings: {
            ...defaultProjectSettings,
            ...projectSettings,
            name: file.name.replace(/\.[^.]+$/, ""),
          },
          simulationSettings: buildDefaultSimulationSettings({ isReportYesOn }),
        });
        if (!started) {
          setDialogState(null);
          return;
        }

        bounds.map((importedExtent) => {
          map?.map.fitBounds(importedExtent as LngLatBoundsLike, {
            padding: 100,
            duration: 0,
          });
        });

        setInpFileInfo(null);
        setProjectFileInfo(null);
        setSavedProjectRevision(null);
        setDialogState(null);

        userTracking.capture({
          name: "importSynergi.completed",
          source,
          counts: { junctions: network.junctions.length },
        });
      } catch (error) {
        handleError(error, {
          as: "Import Synergi failed",
          onUnexpected: "capture",
          contexts: { "Import file": { name: file.name, size: file.size } },
        });
        setDialogState({ type: "invalidFilesError" });
      }
    },
    [
      projections,
      labelMaxLength,
      isReportYesOn,
      startNewProject,
      map,
      setDialogState,
      setInpFileInfo,
      setProjectFileInfo,
      setSavedProjectRevision,
      userTracking,
    ],
  );

  const openSynergi = useCallback(
    async ({ source }: { source: string }) => {
      userTracking.capture({ name: "importSynergi.started", source });

      if (!isReady) throw new Error("FS not ready");
      try {
        const file = await openFile({
          multiple: false,
          extensions: [synergiExtension],
          description: "Synergi database",
        });

        if (!file) return;

        void importSynergi(file, source);
      } catch (error) {
        captureError(error as Error);
      }
    },
    [openFile, isReady, importSynergi, userTracking],
  );

  return useCallback(
    ({ source }: { source: ImportSynergiStarted["source"] }) => {
      checkUnsavedChanges(() => openSynergi({ source }));
    },
    [openSynergi, checkUnsavedChanges],
  );
};

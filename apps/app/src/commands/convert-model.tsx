import { useCallback, useContext } from "react";
import { useSetAtom } from "jotai";
import { FileWithHandle } from "browser-fs-access";
import type { Converter, NetworkData } from "@epanet-js/converters";
import { LngLatBoundsLike } from "mapbox-gl";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { useUnsavedChangesCheck } from "./check-unsaved-changes";
import {
  blockingIssues,
  buildModel,
  getConverter,
  issueCodes,
  type ConverterVendor,
} from "src/lib/converters";
import { dialogAtom } from "src/state/dialog";
import { inpFileInfoAtom, projectFileInfoAtom } from "src/state/file-system";
import { savedProjectRevisionAtom } from "src/state/project-revision";
import { captureError } from "src/infra/error-tracking";
import { handleError } from "src/infra/errors";
import { ConvertModelStarted, useUserTracking } from "src/infra/user-tracking";
import { useFileOpen } from "src/hooks/use-file-open";
import { useProjections } from "src/hooks/use-projections";
import { useLabelMaxLength } from "src/hooks/use-label-max-length";
import {
  defaultSimulationSettings,
  type SimulationSettings,
} from "src/simulation/simulation-settings";
import { useStartNewProject } from "src/hooks/persistence/use-start-new-project";
import { MapContext } from "src/map";

export const useConvertModel = () => {
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const userTracking = useUserTracking();
  const { openFile, isReady } = useFileOpen();
  const { projections } = useProjections();
  const labelMaxLength = useLabelMaxLength();
  const { startNewProject } = useStartNewProject();
  const setDialogState = useSetAtom(dialogAtom);
  const setInpFileInfo = useSetAtom(inpFileInfoAtom);
  const setProjectFileInfo = useSetAtom(projectFileInfoAtom);
  const setSavedProjectRevision = useSetAtom(savedProjectRevisionAtom);
  const map = useContext(MapContext);

  const convertFile = useCallback(
    async (
      converter: Converter,
      vendor: ConverterVendor,
      file: FileWithHandle,
      source: string,
    ) => {
      if (!projections) {
        setDialogState({ type: "invalidFilesError" });
        userTracking.capture({ name: "invalidFilesError.seen" });
        return;
      }

      setDialogState({ type: "loading" });

      try {
        const { network, issues } = await converter.parseNetworkData({
          files: [file],
        });

        const blocking = blockingIssues(issues);
        if (blocking.length > 0) {
          userTracking.capture({
            name: "convertModel.failed",
            source,
            vendor,
            issues: issueCodes(blocking),
          });
          setDialogState({ type: "convertModelFailed", issues: blocking });
          return;
        }

        const {
          hydraulicModel,
          factories,
          projectSettings,
          bounds,
          issues: builderIssues,
        } = buildModel(network, { projections, labelMaxLength });
        const allIssues = [...issues, ...builderIssues];

        const started = await startNewProject({
          hydraulicModel,
          factories,
          projectSettings: {
            ...defaultProjectSettings,
            ...projectSettings,
            name: file.name.replace(/\.[^.]+$/, ""),
          },
          simulationSettings: withSourceTiming(
            defaultSimulationSettings,
            network,
          ),
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

        userTracking.capture({
          name: "convertModel.completed",
          source,
          vendor,
          counts: {
            junctions: network.junctions.length,
            reservoirs: network.reservoirs.length,
            tanks: network.tanks.length,
            pipes: network.pipes.length,
            pumps: network.pumps.length,
            valves: network.valves.length,
          },
          issues: issueCodes(allIssues),
        });

        setDialogState(
          allIssues.length > 0
            ? { type: "convertModelIssues", issues: allIssues }
            : null,
        );
      } catch (error) {
        handleError(error, {
          as: "Convert model failed",
          onUnexpected: "capture",
          contexts: {
            "Import file": { name: file.name, size: file.size, vendor },
          },
        });
        setDialogState({ type: "invalidFilesError" });
      }
    },
    [
      projections,
      labelMaxLength,
      startNewProject,
      map,
      setDialogState,
      setInpFileInfo,
      setProjectFileInfo,
      setSavedProjectRevision,
      userTracking,
    ],
  );

  const pickAndConvert = useCallback(
    async ({ vendor, source }: { vendor: ConverterVendor; source: string }) => {
      userTracking.capture({ name: "convertModel.started", source, vendor });

      const converter = getConverter(vendor);
      if (!converter) {
        setDialogState({ type: "invalidFilesError" });
        userTracking.capture({ name: "invalidFilesError.seen" });
        return;
      }

      if (!isReady) throw new Error("FS not ready");
      try {
        const file = await openFile({
          multiple: false,
          extensions: converter.extensions,
          description: converter.name,
        });

        if (!file) return;

        void convertFile(converter, vendor, file, source);
      } catch (error) {
        captureError(error as Error);
      }
    },
    [openFile, isReady, convertFile, setDialogState, userTracking],
  );

  return useCallback(
    ({
      vendor,
      source,
    }: {
      vendor: ConverterVendor;
      source: ConvertModelStarted["source"];
    }) => {
      checkUnsavedChanges(() => pickAndConvert({ vendor, source }));
    },
    [pickAndConvert, checkUnsavedChanges],
  );
};

const withSourceTiming = (
  settings: SimulationSettings,
  { patternTimeStep, simulationDuration }: NetworkData,
): SimulationSettings => {
  const timing = {
    ...settings.timing,
    ...(patternTimeStep === undefined
      ? {}
      : {
          patternTimestep: patternTimeStep,
          hydraulicTimestep: patternTimeStep,
          reportTimestep: patternTimeStep,
        }),
    ...(simulationDuration === undefined
      ? {}
      : { duration: simulationDuration }),
  };

  return { ...settings, timing };
};

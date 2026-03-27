import { useCallback, useContext } from "react";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { fileInfoAtom } from "src/state/file-system";
import { captureError } from "src/infra/error-tracking";
import { FileWithHandle } from "browser-fs-access";
import { useTranslate } from "src/hooks/use-translate";
import {
  ParserIssues,
  parseInp,
  parseCoordinatesGeoJson,
} from "src/import/inp";
import type { ParseInpResult } from "src/import/inp";
import { usePersistence } from "src/lib/persistence";
import { FeatureCollection } from "geojson";
import { getExtent } from "src/lib/geometry";
import { LngLatBoundsLike } from "mapbox-gl";
import { MapContext, captureThumbnail } from "src/map";
import { ImportInpCompleted, useUserTracking } from "src/infra/user-tracking";
import { InpStats } from "src/import/inp/inp-data";
import { ProjectSettings } from "src/lib/project-settings";
import { HydraulicModel } from "src/hydraulic-model";
import { chooseUnitSystem } from "src/simulation/build-inp";
import { notify } from "src/components/notifications";
import { WarningIcon } from "src/icons";
import { OPFSStorage } from "src/infra/storage";
import { getAppId } from "src/infra/app-instance";
import { isDemoNetwork } from "src/demo/demo-networks";
import { useRecentFiles } from "src/hooks/use-recent-files";
import { type Projection, createProjectionMapper } from "src/lib/projections";
import { transformCoordinates } from "src/hydraulic-model/mutations/transform-coordinates";
import { XY_GRID } from "src/import/inp/parse-inp";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const inpExtension = ".inp";

export const useImportInp = () => {
  const translate = useTranslate();
  const setDialogState = useSetAtom(dialogAtom);
  const map = useContext(MapContext);
  const setFileInfo = useSetAtom(fileInfoAtom);
  const rep = usePersistence();
  const transactImport = rep.useTransactImport();
  const userTracking = useUserTracking();
  const isProjectLaterOn = useFeatureFlag("FLAG_PROJECT_LATER");

  const { addRecent } = useRecentFiles();

  const completeImport = useCallback(
    async (
      file: FileWithHandle,
      isDemo: boolean,
      result: ParseInpResult,
      options?: { autoElevations?: boolean },
    ) => {
      const {
        hydraulicModel,
        factories,
        projectSettings,
        simulationSettings,
        issues,
        isMadeByApp,
      } = result;

      const storage = new OPFSStorage(getAppId());
      await storage.clear();

      transactImport(
        hydraulicModel,
        factories,
        projectSettings,
        file.name,
        simulationSettings,
        options,
      );

      const features: FeatureCollection = {
        type: "FeatureCollection",
        features: [...hydraulicModel.assets.values()].map((a) => a.feature),
      };
      const nextExtent = getExtent(features);
      nextExtent.map((importedExtent) => {
        map?.map.fitBounds(importedExtent as LngLatBoundsLike, {
          padding: 100,
          duration: 0,
        });
      });
      setFileInfo({
        name: file.name,
        handle: isMadeByApp ? file.handle : undefined,
        modelVersion: hydraulicModel.version,
        isMadeByApp,
        isDemoNetwork: isDemo,
        options: { type: "inp", folderId: "" },
      });
      if (!isDemo && file.handle) {
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
          void addRecent(name, handle);
        }
      }
      if (!issues) {
        setDialogState(null);
        return;
      }

      setDialogState({ type: "inpIssues", issues });
    },
    [addRecent, map, setDialogState, setFileInfo, transactImport],
  );

  const validateAndPrepare = useCallback(
    (files: FileWithHandle[]) => {
      const inps = files.filter((file) =>
        file.name.toLowerCase().endsWith(inpExtension),
      );

      if (!inps.length) {
        setDialogState({ type: "invalidFilesError" });
        userTracking.capture({ name: "invalidFilesError.seen" });
        return null;
      }

      if (inps.length > 1) {
        notify({
          variant: "warning",
          size: "md",
          title: translate("onlyOneInp"),
          description: translate("onlyOneInpExplain"),
          Icon: WarningIcon,
        });
      }

      return inps[0];
    },
    [setDialogState, translate, userTracking],
  );

  const importInpDeprecated = useCallback(
    async (files: FileWithHandle[]) => {
      const file = validateAndPrepare(files);
      if (!file) return;

      setDialogState({ type: "loading" });

      try {
        const arrayBuffer = await file.arrayBuffer();
        const content = new TextDecoder().decode(arrayBuffer);
        const isDemo = isDemoNetwork(content);
        const parseOptions = {
          customerPoints: true,
          inactiveAssets: true,
        };

        const result = parseInp(content, parseOptions);
        const { hydraulicModel, projectSettings, issues, stats } = result;
        userTracking.capture(
          buildCompleteEvent(hydraulicModel, projectSettings, issues, stats),
        );

        if (issues && (issues.invalidVertices || issues.invalidCoordinates)) {
          const previewGeoJson = parseCoordinatesGeoJson(content);

          const onImportWithProjection = async (projection: Projection) => {
            setDialogState({ type: "loading" });
            try {
              const sourceProjection =
                projection.type === "xy-grid" ? XY_GRID : projection;
              const reparsed = parseInp(content, {
                ...parseOptions,
                sourceProjection,
              });
              userTracking.capture(
                buildCompleteEvent(
                  reparsed.hydraulicModel,
                  reparsed.projectSettings,
                  reparsed.issues,
                  reparsed.stats,
                ),
              );
              const autoElevations = projection.type !== "xy-grid";
              await completeImport(file, isDemo, reparsed, {
                autoElevations,
              });
            } catch (error) {
              captureError(error as Error);
              setDialogState({ type: "invalidFilesError" });
            }
          };

          setDialogState({
            type: "networkProjection",
            previewGeoJson,
            onImportWithProjection,
            filename: file.name,
            flowUnits: chooseUnitSystem(projectSettings.units),
          });
          return;
        }

        if (issues && issues.nodesMissingCoordinates) {
          setDialogState({ type: "inpMissingCoordinates", issues });
          return;
        }

        const autoElevations = projectSettings.projection.type !== "xy-grid";
        await completeImport(file, isDemo, result, { autoElevations });
      } catch (error) {
        captureError(error as Error);
        setDialogState({ type: "invalidFilesError" });
      }
    },
    [completeImport, setDialogState, userTracking, validateAndPrepare],
  );

  const importInp = useCallback(
    async (files: FileWithHandle[]) => {
      const file = validateAndPrepare(files);
      if (!file) return;

      setDialogState({ type: "loading" });

      try {
        const arrayBuffer = await file.arrayBuffer();
        const content = new TextDecoder().decode(arrayBuffer);
        const isDemo = isDemoNetwork(content);
        const parseOptions = {
          customerPoints: true,
          inactiveAssets: true,
        };

        const result = parseInp(content, {
          ...parseOptions,
          projectLater: true,
        });
        const {
          hydraulicModel,
          projectSettings,
          issues,
          stats,
          projectionStatus,
        } = result;
        userTracking.capture(
          buildCompleteEvent(hydraulicModel, projectSettings, issues, stats),
        );

        if (projectionStatus === "unknown") {
          const previewGeoJson = parseCoordinatesGeoJson(content);

          const onImportWithProjection = async (projection: Projection) => {
            setDialogState({ type: "loading" });
            try {
              const mapper = createProjectionMapper(projection);
              transformCoordinates(hydraulicModel, mapper.toWgs84);
              result.projectSettings = {
                ...result.projectSettings,
                projection,
              };
              const autoElevations = projection.type !== "xy-grid";
              await completeImport(file, isDemo, result, {
                autoElevations,
              });
            } catch (error) {
              captureError(error as Error);
              setDialogState({ type: "invalidFilesError" });
            }
          };

          setDialogState({
            type: "networkProjection",
            previewGeoJson,
            onImportWithProjection,
            filename: file.name,
            flowUnits: chooseUnitSystem(projectSettings.units),
          });
          return;
        }

        if (issues && issues.nodesMissingCoordinates) {
          setDialogState({ type: "inpMissingCoordinates", issues });
          return;
        }

        const autoElevations = projectSettings.projection.type !== "xy-grid";
        await completeImport(file, isDemo, result, { autoElevations });
      } catch (error) {
        captureError(error as Error);
        setDialogState({ type: "invalidFilesError" });
      }
    },
    [completeImport, setDialogState, userTracking, validateAndPrepare],
  );

  return isProjectLaterOn ? importInp : importInpDeprecated;
};

const buildCompleteEvent = (
  hydraulicModel: HydraulicModel,
  projectSettings: ProjectSettings,
  issues: ParserIssues | null,
  stats: InpStats,
): ImportInpCompleted => {
  const issueKeys = issues ? Object.keys(issues) : [];

  const processedIssues = issueKeys.flatMap((key) => {
    if (key === "waterQualityType" && issues?.waterQualityType) {
      const typeMap = {
        AGE: "hasWaterAge",
        CHEMICAL: "hasWaterChemical",
        TRACE: "hasWaterTrace",
      } as const;
      return [typeMap[issues.waterQualityType]];
    }
    if (key === "unsupportedSections" && issues?.unsupportedSections) {
      return [...issues.unsupportedSections].map(
        (sectionName) => `unsupportedSection-${sectionName}` as const,
      );
    }
    if (key === "nonDefaultOptions" && issues?.nonDefaultOptions) {
      return [...issues.nonDefaultOptions.keys()].map(
        (optionName) => `nonDefaultOption-${optionName}` as const,
      );
    }
    if (key === "nonDefaultTimes" && issues?.nonDefaultTimes) {
      return [...issues.nonDefaultTimes.keys()].map(
        (timeName) => `nonDefaultTime-${timeName}` as const,
      );
    }
    return [key];
  });

  return {
    name: "importInp.completed",
    counts: Object.fromEntries(stats.counts),
    headlossFormula: projectSettings.headlossFormula,
    units: chooseUnitSystem(projectSettings.units),
    issues: processedIssues,
  } as ImportInpCompleted;
};

import { useCallback, useContext } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { dialogAtom, fileInfoAtom } from "src/state/jotai";
import { captureError } from "src/infra/error-tracking";
import { FileWithHandle } from "browser-fs-access";
import { useTranslate } from "src/hooks/use-translate";
import { ParserIssues, parseInp } from "src/import/inp";
import { usePersistence } from "src/lib/persistence/context";
import { FeatureCollection } from "geojson";
import { getExtent } from "src/lib/geometry";
import { LngLatBoundsLike } from "mapbox-gl";
import { MapContext } from "src/map";
import { ImportInpCompleted, useUserTracking } from "src/infra/user-tracking";
import { InpStats } from "src/import/inp/inp-data";
import { ModelMetadata } from "src/model-metadata";
import { HydraulicModel } from "src/hydraulic-model";
import { EpanetUnitSystem } from "src/simulation/build-inp";
import { notify } from "src/components/notifications";
import { WarningIcon } from "src/icons";
import { OPFSStorage } from "src/infra/storage";
import { getAppId } from "src/infra/app-instance";
import { useLegitFs } from "src/components/legit-fs-provider";

export const inpExtension = ".inp";

export const useImportInp = () => {
  const translate = useTranslate();
  const setDialogState = useSetAtom(dialogAtom);
  const map = useContext(MapContext);
  const setFileInfo = useSetAtom(fileInfoAtom);
  const fileInfo = useAtomValue(fileInfoAtom);
  const rep = usePersistence();
  const transactImport = rep.useTransactImport();
  const userTracking = useUserTracking();
  const legitFs = useLegitFs();

  // Shared logic for processing and importing INP content
  const processAndImportInp = useCallback(
    async (
      content: string,
      fileName: string,
      fileHandle?: FileSystemFileHandle,
    ) => {
      const parseOptions = {
        customerPoints: true,
        inactiveAssets: true,
      };
      const { hydraulicModel, modelMetadata, issues, isMadeByApp, stats } =
        parseInp(content, parseOptions);
      userTracking.capture(
        buildCompleteEvent(hydraulicModel, modelMetadata, issues, stats),
      );
      if (issues && (issues.invalidVertices || issues.invalidCoordinates)) {
        setDialogState({ type: "inpGeocodingNotSupported" });
        return;
      }

      if (issues && issues.nodesMissingCoordinates) {
        setDialogState({ type: "inpMissingCoordinates", issues });
        return;
      }

      const storage = new OPFSStorage(getAppId());
      await storage.clear();

      transactImport(hydraulicModel, modelMetadata, fileName);

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
        name: fileName,
        handle: isMadeByApp ? fileHandle : undefined,
        modelVersion: hydraulicModel.version,
        isMadeByApp,
        options: { type: "inp", folderId: "" },
      });
      if (!issues) {
        setDialogState(null);
        return;
      }

      setDialogState({ type: "inpIssues", issues });
    },
    [setDialogState, userTracking, transactImport, map?.map, setFileInfo],
  );

  const importInp = useCallback(
    async (files: FileWithHandle[]) => {
      const inps = files.filter((file) =>
        file.name.toLowerCase().endsWith(inpExtension),
      );

      if (!inps.length) {
        setDialogState({
          type: "invalidFilesError",
        });
        userTracking.capture({ name: "invalidFilesError.seen" });
        return;
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

      const file = inps[0];

      setDialogState({ type: "loading" });

      try {
        let content: string;
        // Try to read from versioned filesystem first
        if (legitFs) {
          try {
            content = await legitFs.promises.readFile(file.name, "utf8");
          } catch (legitFsError) {
            // File doesn't exist in versioned FS, fall back to File API
            const arrayBuffer = await file.arrayBuffer();
            content = new TextDecoder().decode(arrayBuffer);
          }
        } else {
          // No versioned FS available, use File API
          const arrayBuffer = await file.arrayBuffer();
          content = new TextDecoder().decode(arrayBuffer);
        }
        await processAndImportInp(content, file.name, file.handle);
      } catch (error) {
        captureError(error as Error);
        setDialogState({ type: "invalidFilesError" });
      }
    },
    [translate, setDialogState, userTracking, legitFs, processAndImportInp],
  );

  const reloadFromVersionedFs = useCallback(
    async (fileName: string) => {
      if (!legitFs) {
        return;
      }

      const projectName = fileName;
      const inpFileName = fileName.replace(/\.epanet$/, ".inp");

      setDialogState({ type: "loading" });

      try {
        const content = await legitFs.promises.readFile(inpFileName, "utf8");
        await processAndImportInp(
          content,
          projectName,
          fileInfo?.handle instanceof FileSystemFileHandle
            ? fileInfo.handle
            : undefined,
        );
      } catch (error) {
        captureError(error as Error);
        setDialogState({ type: "invalidFilesError" });
      }
    },
    [legitFs, setDialogState, processAndImportInp, fileInfo?.handle],
  );

  return { importInp, reloadFromVersionedFs };
};

const buildCompleteEvent = (
  hydraulicModel: HydraulicModel,
  modelMetadata: ModelMetadata,
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
    return [key];
  });

  return {
    name: "importInp.completed",
    counts: Object.fromEntries(stats.counts),
    headlossFormula: hydraulicModel.headlossFormula,
    units: modelMetadata.quantities.specName as EpanetUnitSystem,
    issues: processedIssues,
  } as ImportInpCompleted;
};

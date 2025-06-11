import { useCallback, useContext } from "react";
import { useSetAtom } from "jotai";
import { dialogAtom, fileInfoAtom } from "src/state/jotai";
import { captureError } from "src/infra/error-tracking";
import { FileWithHandle } from "browser-fs-access";
import { translate } from "src/infra/i18n";
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
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { notify } from "src/components/notifications";

export const inpExtension = ".inp";

export const useImportInp = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const map = useContext(MapContext);
  const setFileInfo = useSetAtom(fileInfoAtom);
  const rep = usePersistence();
  const transactImport = rep.useTransactImport();
  const userTracking = useUserTracking();

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
          Icon: ExclamationTriangleIcon,
        });
      }

      const file = inps[0];

      setDialogState({ type: "loading" });

      try {
        const arrayBuffer = await file.arrayBuffer();
        const content = new TextDecoder().decode(arrayBuffer);
        const { hydraulicModel, modelMetadata, issues, isMadeByApp, stats } =
          parseInp(content);
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

        transactImport(hydraulicModel, modelMetadata, file.name);

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
          options: { type: "inp", folderId: "" },
        });
        if (!issues) {
          setDialogState(null);
          return;
        }

        setDialogState({ type: "inpIssues", issues });
      } catch (error) {
        captureError(error as Error);
        setDialogState({ type: "invalidFilesError" });
      }
    },
    [map?.map, transactImport, setFileInfo, setDialogState, userTracking],
  );

  return importInp;
};

const buildCompleteEvent = (
  hydraulicModel: HydraulicModel,
  modelMetadata: ModelMetadata,
  issues: ParserIssues | null,
  stats: InpStats,
): ImportInpCompleted => {
  return {
    name: "importInp.completed",
    counts: Object.fromEntries(stats.counts),
    headlossFormula: hydraulicModel.headlossFormula,
    units: modelMetadata.quantities.specName as EpanetUnitSystem,
    issues: issues ? Object.keys(issues) : [],
  } as ImportInpCompleted;
};

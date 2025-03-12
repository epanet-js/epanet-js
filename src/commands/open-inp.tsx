import { useCallback, useContext } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  dialogAtom,
  fileInfoAtom,
  hasUnsavedChangesAtom,
} from "src/state/jotai";
import { useQuery } from "react-query";
import { captureError } from "src/infra/error-tracking";
import toast from "react-hot-toast";
import { FileWithHandle } from "browser-fs-access";
import { translate } from "src/infra/i18n";
import { ParserIssues, parseInp } from "src/import/inp";
import { usePersistence } from "src/lib/persistence/context";
import { FeatureCollection } from "geojson";
import { getExtent } from "src/lib/geometry";
import { LngLatBoundsLike } from "mapbox-gl";
import { MapContext } from "src/map";
import { OpenModelCompleted, useUserTracking } from "src/infra/user-tracking";
import { InpStats } from "src/import/inp/inp-data";
import { ModelMetadata } from "src/model-metadata";
import { HydraulicModel } from "src/hydraulic-model";
import { EpanetUnitSystem } from "src/simulation/build-inp";

const inpExtension = ".inp";

export const openInpShortcut = "ctrl+o";

export const useOpenInp = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom);
  const map = useContext(MapContext);
  const setFileInfo = useSetAtom(fileInfoAtom);
  const rep = usePersistence();
  const transactImport = rep.useTransactImport();
  const userTracking = useUserTracking();

  const { data: fsAccess } = useQuery("browser-fs-access", async () => {
    return import("browser-fs-access");
  });

  const importInp = useCallback(
    async (file: FileWithHandle) => {
      try {
        if (!file.name.toLowerCase().endsWith(".inp")) {
          setDialogState({
            type: "openError",
            file,
          });
          return;
        }

        setDialogState({ type: "loading" });
        const arrayBuffer = await file.arrayBuffer();
        const content = new TextDecoder().decode(arrayBuffer);
        const { hydraulicModel, modelMetadata, issues, isMadeByApp, stats } =
          parseInp(content);
        userTracking.capture(
          buildOpenCompleteEvent(hydraulicModel, modelMetadata, issues, stats),
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
        setDialogState({ type: "openError", file });
      }
    },
    [map?.map, transactImport, setFileInfo, setDialogState, userTracking],
  );

  const findInpInFs = useCallback(async () => {
    if (!fsAccess) throw new Error("Sorry, still loading");
    try {
      const file = await fsAccess.fileOpen({
        multiple: false,
        extensions: [inpExtension],
        description: ".INP",
      });
      void importInp(file);
    } catch (error) {
      captureError(error as Error);
    }
  }, [fsAccess, importInp]);

  const openInpFromFs = useCallback(() => {
    if (hasUnsavedChanges) {
      return setDialogState({
        type: "unsavedChanges",
        onContinue: findInpInFs,
      });
    }

    void findInpInFs();
  }, [findInpInFs, setDialogState, hasUnsavedChanges]);

  const findInpInCandidates = useCallback(
    (candidates: FileWithHandle[]) => {
      const inps = candidates.filter((file) =>
        file.name.toLowerCase().endsWith(inpExtension),
      );

      if (!inps.length) {
        toast.error(translate("inpMissing"));
        return;
      }

      if (inps.length > 1) {
        toast(translate("onlyOneInp"), { icon: "⚠️" });
      }

      void importInp(inps[0]);
    },
    [importInp],
  );

  const openInpFromCandidates = useCallback(
    (candidates: FileWithHandle[]) => {
      if (hasUnsavedChanges) {
        return setDialogState({
          type: "unsavedChanges",
          onContinue: () => findInpInCandidates(candidates),
        });
      }

      findInpInCandidates(candidates);
    },
    [setDialogState, hasUnsavedChanges, findInpInCandidates],
  );

  return { openInpFromCandidates, openInpFromFs };
};

const buildOpenCompleteEvent = (
  hydraulicModel: HydraulicModel,
  modelMetadata: ModelMetadata,
  issues: ParserIssues | null,
  stats: InpStats,
): OpenModelCompleted => {
  return {
    name: "openModel.completed",
    counts: Object.fromEntries(stats.counts),
    headlossFormula: hydraulicModel.headlossFormula,
    units: modelMetadata.quantities.specName as EpanetUnitSystem,
    issues: issues ? Object.keys(issues) : [],
  } as OpenModelCompleted;
};

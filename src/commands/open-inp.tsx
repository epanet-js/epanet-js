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
import { parseInp } from "src/import/inp";
import { usePersistence } from "src/lib/persistence/context";
import { FeatureCollection } from "geojson";
import { getExtent } from "src/lib/geometry";
import { LngLatBoundsLike } from "mapbox-gl";
import { MapContext } from "src/map";
import { isFeatureOn } from "src/infra/feature-flags";
import { useUserTracking } from "src/infra/user-tracking";

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
        const { hydraulicModel, modelMetadata, issues, isMadeByApp } =
          parseInp(content);
        if (
          !issues ||
          (!issues.nodesMissingCoordinates &&
            !issues.invalidCoordinates &&
            !issues.invalidVertices)
        ) {
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
          isFeatureOn("FLAG_TRACKING") &&
            userTracking.capture({
              name: "openModel.completed",
            });
        }
        if (!!issues) {
          setDialogState({ type: "inpIssues", issues });
        } else {
          setDialogState(null);
        }
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
      if (isFeatureOn("FLAG_TRACKING")) {
        void importInp(file);
      } else {
        setDialogState({
          type: "openInp",
          file: file,
        });
      }
    } catch (error) {
      captureError(error as Error);
    }
  }, [fsAccess, setDialogState, importInp]);

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

      if (isFeatureOn("FLAG_TRACKING")) {
        void importInp(inps[0]);
      } else {
        setDialogState({
          type: "openInp",
          file: inps[0],
        });
      }
    },
    [setDialogState, importInp],
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

import type { ConvertResult } from "src/types/export";
import { DialogHeader } from "src/components/dialog";
import { useCallback, useContext, useEffect, useState } from "react";
import { getExtent } from "src/lib/geometry";
import { FeatureCollection } from "src/types";
import { MapContext } from "src/map";
import { LngLatBoundsLike } from "mapbox-gl";
import { useTranslate } from "src/hooks/use-translate";
import { OpenInpDialogState, dialogAtom } from "src/state/dialog";
import { CrossCircledIcon } from "@radix-ui/react-icons";

import { AckDialogAction } from "src/components/dialog";
import { Loading } from "../elements";
import { parseInp } from "src/import/inp";
import { usePersistence } from "src/lib/persistence/context";
import { captureError } from "src/infra/error-tracking";
import { useSetAtom } from "jotai";
import { fileInfoAtom } from "src/state/jotai";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { CircleX } from "lucide-react";

export type OnNext = (arg0: ConvertResult | null) => void;

export function OpenInpDialog({
  modal,
  onClose,
}: {
  modal: OpenInpDialogState;
  onClose: () => void;
}) {
  const translate = useTranslate();
  const { file } = modal;
  const map = useContext(MapContext);

  const [isLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);
  const setDialogState = useSetAtom(dialogAtom);
  const rep = usePersistence();
  const transactImport = rep.useTransactImport();
  const setFileInfo = useSetAtom(fileInfoAtom);
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

  const importInp = useCallback(async () => {
    try {
      if (!file.name.toLowerCase().endsWith(".inp")) {
        setError(true);
        return;
      }

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
      }
      if (!!issues) {
        setDialogState({ type: "inpIssues", issues });
      } else {
        onClose();
      }
    } catch (error) {
      captureError(error as Error);
      setError(true);
    }
  }, [file, map?.map, onClose, transactImport, setFileInfo, setDialogState]);

  useEffect(
    function onRender() {
      importInp().catch((e) => captureError(e));
    },
    [importInp],
  );

  if (error) {
    return (
      <>
        <DialogHeader
          title={translate("error")}
          titleIcon={isLucideIconsOn ? CircleX : CrossCircledIcon}
          variant="danger"
        />
        <div className="text-sm">
          <p>
            {translate("failedToProcessFile")}: {file.name}
          </p>
        </div>
        <AckDialogAction label={translate("understood")} onAck={onClose} />
      </>
    );
  }

  if (isLoading) {
    return <Loading />;
  }

  return null;
}

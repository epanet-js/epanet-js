import type { ConvertResult } from "src/lib/convert/utils";
import { DialogHeader } from "src/components/dialog";
import { useCallback, useContext, useEffect, useState } from "react";
import { getExtent } from "src/lib/geometry";
import { FeatureCollection } from "src/types";
import { MapContext } from "src/map";
import { LngLatBoundsLike } from "mapbox-gl";
import { translate } from "src/infra/i18n";
import { FileGroup } from "src/lib/group_files";
import { OpenInpDialogState } from "src/state/dialog_state";
import { CrossCircledIcon } from "@radix-ui/react-icons";

import { AckDialogAction } from "./simple_dialog_actions";
import { Loading } from "../elements";
import { parseInp } from "src/import/parse-inp";
import { usePersistence } from "src/lib/persistence/context";
import { captureError } from "src/infra/error-tracking";
import { useSetAtom } from "jotai";
import { fileInfoAtom } from "src/state/jotai";

export type OnNext = (arg0: ConvertResult | null) => void;

export function OpenInpDialog({
  modal,
  onClose,
}: {
  modal: OpenInpDialogState;
  onClose: () => void;
}) {
  const { files } = modal;
  const map = useContext(MapContext);

  const [isLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);
  const rep = usePersistence();
  const transactImport = rep.useTransactImport();
  const setFileInfo = useSetAtom(fileInfoAtom);

  const fileGroup = files[0] as FileGroup;

  const importInp = useCallback(async () => {
    try {
      const file = fileGroup.file;
      if (!file.name.toLowerCase().endsWith(".inp")) {
        setError(true);
        return;
      }

      const arrayBuffer = await file.arrayBuffer();
      const content = new TextDecoder().decode(arrayBuffer);
      const { hydraulicModel, modelMetadata } = parseInp(content);
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
        options: { type: "inp", folderId: "" },
      });
      onClose();
    } catch (error) {
      setError(true);
    }
  }, [fileGroup.file, map?.map, onClose, transactImport, setFileInfo]);

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
          titleIcon={CrossCircledIcon}
          variant="danger"
        />
        <div className="text-sm">
          <p>
            {translate("failedToProcessFile")}: {fileGroup.file.name}
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

import type { ConvertResult, InpResult } from "src/lib/convert/utils";
import { DialogHeader } from "src/components/dialog";
import { useContext, useState } from "react";
import { Maybe, Nothing } from "purify-ts/Maybe";
import { extendExtent, getExtent } from "src/lib/geometry";
import { BBox } from "src/types";
import { MapContext } from "src/map";
import { LngLatBoundsLike } from "mapbox-gl";
import addedFeaturesToast from "src/components/added_features_toast";
import { flattenResult } from "./import_utils";
import { translate } from "src/infra/i18n";
import { FileGroup } from "src/lib/group_files";
import { OpenInpDialogState } from "src/state/dialog_state";
import { FilePlusIcon } from "@radix-ui/react-icons";
import {
  DEFAULT_IMPORT_OPTIONS,
  ImportOptions,
  Progress,
} from "src/lib/convert";
import { Form, Formik, FormikHelpers } from "formik";
import { FileWarning } from "./import/file_warning";
import { ImportProgressBar } from "./import/import_progress_bar";
import { AutoDetect } from "./autodetect";
import SimpleDialogActions from "./simple_dialog_actions";
import { useImportFile } from "src/hooks/use_import";

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

  const [extent] = useState<Maybe<BBox>>(Nothing);

  const file = files[0] as FileGroup;

  const handleSuccess: OnNext = (result) => {
    let nextExtent = extent;
    if (result) {
      nextExtent = extendExtent(getExtent(flattenResult(result)), extent);
    }
    nextExtent.map((importedExtent) => {
      map?.map.fitBounds(importedExtent as LngLatBoundsLike, {
        padding: 100,
      });
    });
    if (result) {
      addedFeaturesToast(result);
    }
    return onClose();
  };

  return (
    <>
      <DialogHeader
        title={`${translate("openProject")}:  ${file.file.name}`}
        titleIcon={FilePlusIcon}
      />
      <ImportFileGroup
        onClose={onClose}
        onSuccess={handleSuccess}
        file={file}
      />
    </>
  );
}

export function ImportFileGroup({
  onSuccess,
  onClose,
  file: fileGroup,
}: {
  onSuccess: OnNext;
  onClose: () => void;
  file: FileGroup;
}) {
  const { file } = fileGroup;
  const doImport = useImportFile();
  const [progress, setProgress] = useState<Progress | null>(null);

  return (
    <Formik
      onSubmit={async function onSubmit(
        options: ImportOptions,
        helpers: FormikHelpers<ImportOptions>,
      ) {
        try {
          // Don't show a toast if we're going to import
          // another feature.
          options = { ...options, toast: true };
          const res = await doImport(file, options, (newProgress) => {
            setProgress(newProgress);
          });
          if (
            (res as ConvertResult).type &&
            (res as ConvertResult).type === "inp"
          ) {
            return onSuccess(res as InpResult);
          }
        } catch (e: any) {
          helpers.setErrors({
            type: e.message,
          });
        }
      }}
      initialValues={{
        ...DEFAULT_IMPORT_OPTIONS,
        type: "geojson",
        text: "",
        toast: true,
        secondary: false,
      }}
    >
      <Form>
        <div>
          <FileWarning file={fileGroup}>
            <SimpleDialogActions
              onClose={onClose}
              action={translate("openProject")}
            />
          </FileWarning>
          <ImportProgressBar progress={progress} />
        </div>
        <AutoDetect file={file} />
      </Form>
    </Formik>
  );
}

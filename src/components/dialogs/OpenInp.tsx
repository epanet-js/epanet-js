import type { ConvertResult, InpResult } from "src/lib/convert/utils";
import { DialogHeader } from "src/components/dialog";
import { useContext, useEffect, useState } from "react";
import { Maybe, Nothing } from "purify-ts/Maybe";
import { extendExtent, getExtent } from "src/lib/geometry";
import { BBox } from "src/types";
import { MapContext } from "src/map";
import { LngLatBoundsLike } from "mapbox-gl";
import { flattenResult } from "./import_utils";
import { translate } from "src/infra/i18n";
import { FileGroup } from "src/lib/group_files";
import { OpenInpDialogState } from "src/state/dialog_state";
import { CrossCircledIcon } from "@radix-ui/react-icons";
import {
  DEFAULT_IMPORT_OPTIONS,
  ImportOptions,
  Progress,
} from "src/lib/convert";
import { Form, Formik, FormikHelpers } from "formik";
import { FileWarning } from "./import/file_warning";
import { ImportProgressBar } from "./import/import_progress_bar";
import SimpleDialogActions, { AckDialogAction } from "./simple_dialog_actions";
import { useImportFile } from "src/hooks/use_import";
import { Loading } from "../elements";

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
  const [isLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);
  const doImport = useImportFile();

  const fileGroup = files[0] as FileGroup;

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
    return onClose();
  };

  const importInp = async () => {
    try {
      const options: ImportOptions = {
        ...DEFAULT_IMPORT_OPTIONS,
        type: "inp",
        toast: false,
      };
      const res = (await doImport(
        fileGroup.file,
        options,
        (_newProgress) => {},
      )) as InpResult;
      if (res.hydraulicModel.assets.size === 0) {
        setError(true);
        return;
      }
      return handleSuccess(res);
    } catch (error) {
      setError(true);
    }
  };

  useEffect(() => {
    importInp();
  }, []);

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
        type: "inp",
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
      </Form>
    </Formik>
  );
}

import type { ImportOptions, Progress } from "src/lib/convert";
import { DEFAULT_IMPORT_OPTIONS } from "src/lib/convert";
import { ClipboardIcon } from "@radix-ui/react-icons";
import { DialogHeader } from "src/components/dialog";
import type { FormikHelpers } from "formik";
import { Formik, Form } from "formik";
import { CsvOptionsForm } from "src/components/csv_options_form";
import { SelectFileType } from "src/components/fields";
import { useImportString } from "src/hooks/use_import";
import React, { useState } from "react";
import { StyledFieldTextareaCode } from "src/components/elements";
import SimpleDialogActions from "src/components/dialogs/simple_dialog_actions";
import { CoordinateStringOptionsForm } from "src/components/coordinate_string_options_form";
import { DialogStateLoadText } from "src/state/dialog_state";
import { captureError } from "src/infra/error-tracking";
import * as Comlink from "comlink";
import { ImportProgressBar } from "./import/import_progress_bar";

interface ImportOptionsWithText extends ImportOptions {
  text: string;
}

export function ImportTextDialog({
  modal,
  onClose,
}: {
  modal: DialogStateLoadText;
  onClose: () => void;
}) {
  const doImport = useImportString();
  const [progress, setProgress] = useState<Progress | null>(null);

  async function onSubmit(
    values: ImportOptionsWithText,
    helpers: FormikHelpers<ImportOptionsWithText>
  ) {
    try {
      const { text, ...options } = values;
      (
        await doImport(
          text,
          options,
          Comlink.proxy((newProgress) => {
            setProgress(newProgress);
          })
        )
      ).caseOf({
        Left() {
          helpers.setErrors({
            type: "Import error",
          });
        },
        Right() {
          onClose();
        },
      });
    } catch (e: any) {
      captureError(e);
      helpers.setErrors({
        type: e.message,
      });
    }
  }

  return (
    <>
      <DialogHeader title="Import text" titleIcon={ClipboardIcon} />
      <Formik
        onSubmit={onSubmit}
        initialValues={{
          ...DEFAULT_IMPORT_OPTIONS,
          type: "geojson",
          text: modal.initialValue || "",
          toast: true,
        }}
      >
        {({ values }) => (
          <Form>
            <div>
              <div>
                <div className="space-y-4">
                  <StyledFieldTextareaCode
                    aria-label="Data"
                    as="textarea"
                    name="text"
                    autoFocus
                  />
                  <SelectFileType textOnly />
                  <CoordinateStringOptionsForm />
                  <CsvOptionsForm file={values.text} geocoder />
                </div>
              </div>
              <SimpleDialogActions onClose={onClose} action="Import" />
              <ImportProgressBar progress={progress} />
            </div>
          </Form>
        )}
      </Formik>
    </>
  );
}

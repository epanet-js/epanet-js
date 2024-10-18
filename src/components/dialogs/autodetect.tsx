import { useFormikContext } from "formik";
import { captureError } from "src/infra/error-tracking";
import {
  ImportOptions,
  detectType,
  DEFAULT_IMPORT_OPTIONS,
} from "src/lib/convert";
import { useEffect } from "react";

const defaultOptions = {
  type: "geojson",
  toast: true,
  secondary: false,
  ...DEFAULT_IMPORT_OPTIONS,
} as const;

export function AutoDetect({ file }: { file: File }) {
  const { setValues } = useFormikContext<ImportOptions>();

  useEffect(() => {
    detectType(file)
      .then((detected) => {
        return setValues((values) => ({
          ...values,
          ...detected.orDefault(defaultOptions),
        }));
      })
      .catch((e) => captureError(e));
  }, [file, setValues]);
  return null;
}

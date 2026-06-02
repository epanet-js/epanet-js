import { useTranslate } from "src/hooks/use-translate";
import { DropZone } from "src/components/drop-zone";
import { ErrorIcon } from "src/icons";

export const DataInputStep = ({
  selectedFile,
  onFileDrop,
  error,
  showNoProjectionWarning,
  networkProjectionName,
}: {
  selectedFile: File | null;
  onFileDrop: (file: File) => void;
  error: string | null;
  showNoProjectionWarning: boolean;
  networkProjectionName: string;
}) => {
  const translate = useTranslate();

  return (
    <>
      <h2 className="text-size-heading-3 font-semibold text-slate-900 pt-3 pb-3 dark:text-white">
        {translate("importZones.dataInputStep.addFromFile")}
      </h2>
      <DropZone
        onFileDrop={onFileDrop}
        accept=".geojson"
        supportedFormats="GeoJSON"
        selectedFile={selectedFile}
      />
      {error && (
        <div className="flex items-center gap-2 mt-3 p-3 rounded-md bg-error-subtle text-red-700 text-size-base dark:bg-red-950 dark:text-red-300">
          <ErrorIcon className="shrink-0" />
          {translate(`importZones.errors.${error}`)}
        </div>
      )}
      {showNoProjectionWarning && (
        <div className="flex items-center gap-2 mt-3 p-3 rounded-md bg-info-subtle text-blue-700 text-size-base dark:text-blue-300">
          {translate(
            "importZones.dataInputStep.noProjectionWarning",
            networkProjectionName,
          )}
        </div>
      )}
    </>
  );
};

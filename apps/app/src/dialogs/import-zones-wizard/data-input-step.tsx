import { useTranslate } from "src/hooks/use-translate";
import { DropZone } from "src/components/drop-zone";
import { GisDropZone, type GisFiles } from "src/components/gis-drop-zone";
import { ErrorIcon } from "src/icons";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

type DataInputStepProps = {
  error: string | null;
  showNoProjectionWarning: boolean;
  networkProjectionName: string;
  onFileDrop: (file: File) => void;
  selectedFile: File | null;
};

export const DataInputStep = (props: DataInputStepProps) => {
  const useGisDropZone = useFeatureFlag("FLAG_SHP_ZONE_IMPORT");
  const { error, showNoProjectionWarning, networkProjectionName } = props;
  const translate = useTranslate();

  const selectedGisFiles: GisFiles = props.selectedFile
    ? { geojson: props.selectedFile }
    : {};

  return (
    <>
      <h2 className="text-size-heading-3 font-semibold text-slate-900 pt-3 pb-3 dark:text-white">
        {translate("importZones.dataInputStep.addFromFile")}
      </h2>
      {useGisDropZone ? (
        <GisDropZone
          onFileDrop={(files) => props.onFileDrop(files[0])}
          supportedFormats={["geojson"]}
          selectedFiles={selectedGisFiles}
        />
      ) : (
        <DropZone
          onFileDrop={props.onFileDrop}
          accept=".geojson"
          supportedFormats="GeoJSON"
          selectedFile={props.selectedFile}
        />
      )}
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

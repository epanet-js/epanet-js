import { useCallback } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { DropZone } from "src/components/drop-zone";
import { GisDropZone, type GisFiles } from "src/components/gis-drop-zone";
import { ErrorIcon } from "src/icons";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

const GIS_FILE_EXTENSIONS: Record<string, keyof GisFiles> = {
  ".geojson": "geojson",
  ".shp": "shp",
  ".shx": "shx",
  ".prj": "prj",
  ".cpg": "cpg",
  ".dbf": "dbf",
};

const getGisFileKey = (file: File): keyof GisFiles | null => {
  const name = file.name.toLowerCase();
  for (const [ext, key] of Object.entries(GIS_FILE_EXTENSIONS)) {
    if (name.endsWith(ext)) return key;
  }
  return null;
};

type DataInputStepProps = {
  error: string | null;
  showNoProjectionWarning: boolean;
  networkProjectionName: string;
  onFileDrop: (file: File) => void;
  selectedFile: File | null;
  gisFiles: GisFiles;
  onGisFilesDrop: (gisFiles: GisFiles) => void;
};

export const DataInputStep = (props: DataInputStepProps) => {
  const useGisDropZone = useFeatureFlag("FLAG_SHP_ZONE_IMPORT");
  const { error, showNoProjectionWarning, networkProjectionName, gisFiles } =
    props;
  const translate = useTranslate();

  const handleGisFilesDrop = useCallback(
    (files: File[]) => {
      const updated = { ...gisFiles };
      for (const file of files) {
        const key = getGisFileKey(file);
        if (key) updated[key] = file;
      }
      props.onGisFilesDrop(updated);

      const primaryFile = updated.geojson ?? updated.shp;
      if (primaryFile) {
        props.onFileDrop(primaryFile);
      }
    },
    [gisFiles, props],
  );

  return (
    <>
      <h2 className="text-size-heading-3 font-semibold text-slate-900 pt-3 pb-3 dark:text-white">
        {translate("importZones.dataInputStep.addFromFile")}
      </h2>
      {useGisDropZone ? (
        <GisDropZone
          onFileDrop={handleGisFilesDrop}
          supportedFormats={["geojson", "shapefile"]}
          selectedFiles={gisFiles}
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

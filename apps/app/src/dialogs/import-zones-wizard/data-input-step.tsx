import { Info, TriangleAlert } from "lucide-react";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "@epanet-js/i18n";
import { Callout } from "@epanet-js/ui-kit";
import { GisDropZone, type GisFiles } from "src/components/gis-drop-zone";
import { ErrorIcon } from "src/icons";

type DataInputStepProps = {
  error: string | null;
  showNoProjectionWarning: boolean;
  skippedRecordCount: number;
  gisFiles: GisFiles;
  onGisFilesDrop: (gisFiles: GisFiles) => void;
};

export const DataInputStep = (props: DataInputStepProps) => {
  const { error, showNoProjectionWarning, skippedRecordCount, gisFiles } =
    props;
  const translate = useTranslate();

  return (
    <>
      <h2 className="text-size-heading-3 font-semibold text-slate-900 px-3 pt-3 pb-3 dark:text-white">
        {translate("importZones.dataInputStep.addFromFile")}
      </h2>
      <GisDropZone
        onFileDrop={props.onGisFilesDrop}
        supportedFormats={["geojson", "shapefile"]}
        selectedFiles={gisFiles}
      />
      {error && (
        <Callout
          variant="error"
          description={translate(`importZones.errors.${error}`)}
          Icon={ErrorIcon}
          className="mt-3 mx-3 border rounded-md"
        />
      )}
      {skippedRecordCount > 0 && (
        <Callout
          variant="warning"
          description={translate(
            "importZones.dataInputStep.skippedRecordsWarning",
            localizeDecimal(skippedRecordCount),
          )}
          Icon={TriangleAlert}
          className="mt-3 mx-3 border rounded-md"
        />
      )}
      {showNoProjectionWarning && (
        <Callout
          variant="info"
          description={translate(
            "importZones.dataInputStep.noProjectionWarning",
          )}
          Icon={Info}
          className="mt-3 mx-3 border rounded-md"
        />
      )}
    </>
  );
};

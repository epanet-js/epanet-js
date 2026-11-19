import { useCallback, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { Callout } from "@epanet-js/ui-kit";
import { useTranslate } from "src/hooks/use-translate";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { DropZone } from "src/components/drop-zone";
import { CloseIcon, ErrorIcon, InfoIcon } from "src/icons";
import { useUserTracking } from "src/infra/user-tracking";
import { captureError } from "src/infra/error-tracking";
import { modelFactoriesAtom } from "src/state/model-factories";
import {
  simulationSettingsDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import { useImportSensorData } from "src/commands/import-sensor-data";
import {
  parseSensorDataFile,
  type ParseSensorDataResult,
} from "src/lib/sensor-data/parse-sensor-data-file";
import { checkSensorTiming } from "src/lib/sensor-data/check-sensor-timing";
import { FormatInfo } from "./format-info";
import { useSensorVocabulary } from "./sensor-vocabulary";
import { SensorPreview } from "./sensor-preview";

const ACCEPTED_EXTENSIONS = ".csv,.xlsx";

const REFUSAL_CODES = new Set(["unsupportedFormat", "notAValidSensorFile"]);

const refusalOf = (result: ParseSensorDataResult): string | null => {
  const refusal = result.errors.find(({ code }) => REFUSAL_CODES.has(code));
  if (refusal) return refusal.code;
  if (result.status === "error" && result.errors.length === 0) {
    return "unreadableFile";
  }
  return null;
};

export const ImportSensorDataDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const { labelManager } = useAtomValue(modelFactoriesAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { timing } = useAtomValue(simulationSettingsDerivedAtom);
  const importSensorData = useImportSensorData();

  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [result, setResult] = useState<ParseSensorDataResult | null>(null);

  const timingWarnings = useMemo(
    () => (result ? checkSensorTiming(result.sensors, timing) : []),
    [result, timing],
  );

  const refuse = useCallback(
    (reason: string) => {
      userTracking.capture({ name: "sensorData.importRefused", reason });
      setRefusal(reason);
    },
    [userTracking],
  );

  const vocabulary = useSensorVocabulary();

  const handleFileDrop = useCallback(
    async (dropped: File) => {
      setFile(dropped);
      setRefusal(null);
      setResult(null);
      setIsParsing(true);

      try {
        const parsed = await parseSensorDataFile(
          dropped,
          { labelManager, assets: hydraulicModel.assets },
          vocabulary,
        );
        const reason = refusalOf(parsed);
        if (reason) {
          refuse(reason);
          return;
        }
        setResult(parsed);
      } catch (error) {
        captureError(error as Error);
        refuse("unreadableFile");
      } finally {
        setIsParsing(false);
      }
    },
    [labelManager, hydraulicModel, vocabulary, refuse],
  );

  const handleFileRejected = useCallback(() => {
    setFile(null);
    setResult(null);
    refuse("unsupportedFormat");
  }, [refuse]);

  const handleRemoveFile = useCallback(() => {
    setFile(null);
    setResult(null);
    setRefusal(null);
  }, []);

  const handleImport = useCallback(() => {
    if (!result || result.sensors.length === 0) return;
    importSensorData(result.sensors, {
      skippedCount: result.ignored,
      hasTimingWarning: timingWarnings.length > 0,
    });
    onClose();
  }, [result, timingWarnings, importSensorData, onClose]);

  return (
    <BaseDialog
      title={translate("sensorData.import.title")}
      badge={<FormatInfo />}
      size="lg"
      height="xl"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("sensorData.import.importAction")}
          onAction={handleImport}
          isDisabled={!result || result.sensors.length === 0}
          onClose={onClose}
        />
      }
    >
      <div className="flex flex-col gap-3 flex-1 min-h-0 p-4 overflow-hidden">
        <Callout
          variant="info"
          description={translate("sensorData.import.sessionNote")}
          Icon={InfoIcon}
          className="shrink-0"
        />

        {result && file ? (
          <>
            <div className="flex shrink-0 items-center gap-2 px-3 py-2 border rounded-base text-size-base">
              <span className="grow truncate">{file.name}</span>
              <button
                type="button"
                className="p-1 rounded-base text-subtle hover:text-default hover:bg-base-hover"
                onClick={handleRemoveFile}
                aria-label={translate("sensorData.import.removeFile")}
              >
                <CloseIcon />
              </button>
            </div>
            <SensorPreview result={result} timingWarnings={timingWarnings} />
          </>
        ) : (
          <>
            <DropZone
              onFileDrop={(dropped) => void handleFileDrop(dropped)}
              onFileRejected={handleFileRejected}
              accept={ACCEPTED_EXTENSIONS}
              disabled={isParsing}
              supportedFormats="CSV, XLSX"
              selectedFile={file}
              testId="sensor-data-drop-zone"
            />
            {refusal && (
              <Callout
                variant="error"
                description={translate(`sensorData.import.${refusal}`)}
                Icon={ErrorIcon}
              />
            )}
          </>
        )}
      </div>
    </BaseDialog>
  );
};

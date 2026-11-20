import { useCallback, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { useTranslate } from "src/hooks/use-translate";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { DropZone } from "src/components/drop-zone";
import { ImportFileReport } from "src/components/import-outcome-report";
import type { ImportOutcome } from "src/components/import-outcome";
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
import {
  SENSOR_DATA_IMPORT_KEYS,
  SensorPreview,
  useSensorImportOutcome,
} from "./sensor-preview";

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

  const handleFileRejected = useCallback(
    (rejected: File) => {
      setFile(rejected);
      setResult(null);
      refuse("unsupportedFormat");
    },
    [refuse],
  );

  const handleRemoveFile = useCallback(() => {
    setFile(null);
    setResult(null);
    setRefusal(null);
  }, []);

  const resultOutcome = useSensorImportOutcome(result, timingWarnings);
  const outcome: ImportOutcome | null = refusal
    ? {
        status: "failed",
        message: translate(`${SENSOR_DATA_IMPORT_KEYS}.${refusal}`),
      }
    : resultOutcome;

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
        <p className="shrink-0 text-size-base text-subtle">
          {translate("sensorData.import.sessionNote")}
        </p>

        {file && outcome ? (
          <>
            <div className="shrink-0">
              <ImportFileReport
                fileName={file.name}
                outcome={outcome}
                translationKeys={SENSOR_DATA_IMPORT_KEYS}
                onRemove={handleRemoveFile}
                removeLabel={translate("sensorData.import.removeFile")}
              />
            </div>
            {result && <SensorPreview result={result} />}
          </>
        ) : (
          <DropZone
            onFileDrop={(dropped) => void handleFileDrop(dropped)}
            onFileRejected={handleFileRejected}
            accept={ACCEPTED_EXTENSIONS}
            disabled={isParsing}
            supportedFormats="CSV, XLSX"
            selectedFile={file}
            testId="sensor-data-drop-zone"
          />
        )}
      </div>
    </BaseDialog>
  );
};

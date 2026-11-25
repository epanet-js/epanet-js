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
  parseSensorTimeSeriesFile,
  type ParseSensorDataResult,
} from "src/lib/sensor-data/parse-sensor-data-file";
import {
  checkSensorTimes,
  checkSensorTiming,
} from "src/lib/sensor-data/check-sensor-timing";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { FormatInfo } from "./format-info";
import { useSensorVocabulary } from "./sensor-vocabulary";
import { refusalOf, type Refusal } from "./refusal";
import { ImportSensorFilesDialog } from "./import-sensor-files";
import {
  SENSOR_DATA_IMPORT_KEYS,
  SensorPreview,
  useSensorImportOutcome,
} from "./sensor-preview";

const ACCEPTED_EXTENSIONS = ".csv,.xlsx";

export const ImportSensorDataDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const isSensorMultiFileOn = useFeatureFlag("FLAG_SENSOR_MULTI_FILE");
  const isSensorTimeSeriesOn = useFeatureFlag("FLAG_SENSOR_TIME_SERIES");
  return isSensorMultiFileOn && isSensorTimeSeriesOn ? (
    <ImportSensorFilesDialog onClose={onClose} />
  ) : (
    <ImportSensorFileDialog onClose={onClose} />
  );
};

const ImportSensorFileDialog = ({ onClose }: { onClose: () => void }) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const { labelManager } = useAtomValue(modelFactoriesAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { timing } = useAtomValue(simulationSettingsDerivedAtom);
  const importSensorData = useImportSensorData();
  const isSensorTimeSeriesOn = useFeatureFlag("FLAG_SENSOR_TIME_SERIES");

  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [result, setResult] = useState<ParseSensorDataResult | null>(null);

  const timingWarnings = useMemo(() => {
    if (!result) return [];
    return isSensorTimeSeriesOn
      ? checkSensorTimes(result, timing)
      : checkSensorTiming(result.sensors, timing);
  }, [result, timing, isSensorTimeSeriesOn]);

  const refuse = useCallback(
    (refusal: Refusal) => {
      userTracking.capture({
        name: "sensorData.importRefused",
        reason: refusal.code,
      });
      setRefusal(refusal);
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
        const parse = isSensorTimeSeriesOn
          ? parseSensorTimeSeriesFile
          : parseSensorDataFile;
        const parsed = await parse(
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
        refuse({ code: "unreadableFile" });
      } finally {
        setIsParsing(false);
      }
    },
    [labelManager, hydraulicModel, vocabulary, refuse, isSensorTimeSeriesOn],
  );

  const handleFileRejected = useCallback(
    (rejected: File) => {
      setFile(rejected);
      setResult(null);
      refuse({ code: "unsupportedFormat" });
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
        message: translate(
          `${SENSOR_DATA_IMPORT_KEYS}.${refusal.code}`,
          ...(refusal.params ?? []),
        ),
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
                help={refusal ? <FormatInfo variant="link" /> : undefined}
              />
            </div>
            {result && <SensorPreview sensors={result.sensors} />}
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
            formatHelp={<FormatInfo />}
          />
        )}
      </div>
    </BaseDialog>
  );
};

import { useCallback, useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import clsx from "clsx";
import { localizeDecimal } from "@epanet-js/i18n";
import { useTranslate } from "src/hooks/use-translate";
import { useDropZone } from "src/hooks/use-drop-zone";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import {
  ImportIssuesReport,
  type IssueGroup,
} from "src/components/import-outcome-report";
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
  parseSensorTimeSeriesFile,
  type ImportedSensor,
  type ParseSensorDataResult,
} from "src/lib/sensor-data/parse-sensor-data-file";
import {
  expandZipFiles,
  isZipFile,
} from "src/lib/sensor-data/expand-zip-files";
import { mergeSensorFiles } from "src/lib/sensor-data/merge-sensor-files";
import { checkSensorTimes } from "src/lib/sensor-data/check-sensor-timing";
import { useSensorVocabulary } from "./sensor-vocabulary";
import { refusalOf, type Refusal } from "./refusal";
import {
  SENSOR_DATA_IMPORT_KEYS,
  SensorPreview,
  sensorImportOutcome,
} from "./sensor-preview";
import { SensorPreviewGraph } from "./sensor-preview-graph";
import { useSidebarWidth, VerticalResizer } from "../vertical-resizer";
import {
  EmptyFilesDropZone,
  SensorFilesPanel,
  type SensorFileCard,
} from "./sensor-files-list";

const SIDEBAR_WIDTH = 288;
const SIDEBAR_MIN_WIDTH = 200;
const PREVIEW_MIN_WIDTH = 200;
const ACCEPTED_EXTENSIONS = ".csv,.xlsx,.zip";
const SHEET_FILE = /\.(csv|xlsx)$/i;

type FileEntry = { id: number; name: string } & (
  | { state: "reading" }
  | { state: "read"; result: ParseSensorDataResult }
  | { state: "refused"; refusal: Refusal }
);

type ReadEntry = Extract<FileEntry, { state: "read" }>;

const refused = (refusal: Refusal) => ({
  state: "refused" as const,
  refusal,
});

export const ImportSensorFilesDialog = ({
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
  const vocabulary = useSensorVocabulary();

  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [chosenSensor, setChosenSensor] = useState<string | null>(null);
  const [pendingDrops, setPendingDrops] = useState(0);
  const sidebar = useSidebarWidth({
    initial: SIDEBAR_WIDTH,
    min: SIDEBAR_MIN_WIDTH,
    reserve: PREVIEW_MIN_WIDTH,
  });
  const nextId = useRef(1);
  const dropQueue = useRef<Promise<void>>(Promise.resolve());
  const zipCount = useRef(0);

  const trackRefusals = useCallback(
    (codes: string[]) => {
      if (codes.length === 0) return;
      userTracking.capture({
        name: "sensorData.filesRefused",
        count: codes.length,
        reasons: [...new Set(codes)],
      });
    },
    [userTracking],
  );

  const readFile = useCallback(
    async (file: File): Promise<FileEntry> => {
      const base = { id: 0, name: file.name };
      if (!SHEET_FILE.test(file.name)) {
        return { ...base, ...refused({ code: "unsupportedFormat" }) };
      }
      try {
        const result = await parseSensorTimeSeriesFile(
          file,
          { labelManager, assets: hydraulicModel.assets },
          vocabulary,
        );
        const refusal = refusalOf(result);
        return refusal
          ? { ...base, ...refused(refusal) }
          : { ...base, state: "read", result };
      } catch (error) {
        captureError(error as Error);
        return { ...base, ...refused({ code: "unreadableFile" }) };
      }
    },
    [labelManager, hydraulicModel, vocabulary],
  );

  const readDropped = useCallback(
    async (dropped: File[]) => {
      const refusals: string[] = [];
      try {
        zipCount.current += dropped.filter(isZipFile).length;
        const { files, skipped } = await expandZipFiles(dropped);
        const pending = files.map((file) => ({ id: nextId.current++, file }));
        const broken: FileEntry[] = skipped.map(({ name, reason }) => ({
          id: nextId.current++,
          name,
          ...refused({
            code: reason === "tooDeep" ? "zipTooDeep" : "unreadableFile",
          }),
        }));
        setEntries((previous) => [
          ...previous,
          ...pending.map(
            ({ id, file }): FileEntry => ({
              id,
              name: file.name,
              state: "reading",
            }),
          ),
          ...broken,
        ]);
        for (const entry of broken) {
          if (entry.state === "refused") refusals.push(entry.refusal.code);
        }
        for (const { id, file } of pending) {
          const entry = await readFile(file);
          if (entry.state === "refused") refusals.push(entry.refusal.code);
          setEntries((previous) =>
            previous.map((existing) =>
              existing.id === id ? { ...entry, id } : existing,
            ),
          );
        }
      } finally {
        trackRefusals(refusals);
        setPendingDrops((count) => count - 1);
      }
    },
    [readFile, trackRefusals],
  );

  const handleFilesDrop = useCallback(
    (dropped: File[]) => {
      setPendingDrops((count) => count + 1);
      dropQueue.current = dropQueue.current
        .then(() => readDropped(dropped))
        .catch((error) => captureError(error as Error));
    },
    [readDropped],
  );

  const handleRemove = useCallback((id: number) => {
    setEntries((previous) => previous.filter((entry) => entry.id !== id));
    setPickedId((current) => (current === id ? null : current));
  }, []);

  const handleToggle = useCallback((id: number) => {
    setPickedId((current) => (current === id ? null : id));
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const openFileBrowser = useCallback(() => fileInputRef.current?.click(), []);
  const { dragState, dropZoneProps, inputProps } = useDropZone({
    onFileDrop: () => {},
    onFilesDrop: handleFilesDrop,
    multiple: true,
  });
  const { onDragEnter, onDragLeave, onDragOver, onDrop } = dropZoneProps;
  const dropTargetProps = { onDragEnter, onDragLeave, onDragOver, onDrop };

  const resizer = <VerticalResizer {...sidebar.resizerProps} />;

  const readEntries = useMemo(
    () => entries.filter((entry): entry is ReadEntry => entry.state === "read"),
    [entries],
  );
  const merged = useMemo(
    () =>
      mergeSensorFiles(
        readEntries.map(({ name, result }) => ({ name, result })),
      ),
    [readEntries],
  );
  const timingByFile = useMemo(
    () =>
      readEntries.map(({ result }, file) =>
        checkSensorTimes(
          { sensors: merged.sensorsByFile[file], columns: result.columns },
          timing,
        ),
      ),
    [readEntries, merged, timing],
  );

  const { outcomes, sensorsByFile } = useMemo(() => {
    const byId = new Map<number, ImportOutcome | null>();
    const sensorsById = new Map<number, ImportedSensor[]>();
    for (const entry of entries) {
      if (entry.state === "reading") byId.set(entry.id, null);
      if (entry.state === "refused") {
        byId.set(entry.id, {
          status: "failed",
          message: translate(
            `${SENSOR_DATA_IMPORT_KEYS}.${entry.refusal.code}`,
            ...(entry.refusal.params ?? []),
          ),
        });
      }
    }
    readEntries.forEach(({ id, result }, file) => {
      const mergeErrors = merged.errorsByFile[file];
      const skipped = merged.skippedByFile[file];
      const fileResult: ParseSensorDataResult = {
        ...result,
        sensors: merged.sensorsByFile[file],
        ignored: result.ignored + skipped.size,
        errors: [...result.errors, ...mergeErrors],
      };
      const outcome = sensorImportOutcome(
        fileResult,
        timingByFile[file],
        translate,
      );
      byId.set(
        id,
        outcome.status === "failed" && fileResult.ignored > 0
          ? { ...outcome, status: "warning" }
          : outcome,
      );
      sensorsById.set(id, fileResult.sensors);
    });
    return { outcomes: byId, sensorsByFile: sensorsById };
  }, [entries, readEntries, merged, timingByFile, translate]);

  const cards = useMemo<SensorFileCard[]>(
    () =>
      entries
        .map(({ id, name }) => ({
          id,
          name,
          outcome: outcomes.get(id) ?? null,
        }))
        .sort(
          (a, b) =>
            Number(b.outcome?.status === "failed") -
            Number(a.outcome?.status === "failed"),
        ),
    [entries, outcomes],
  );

  const selectedId = entries.some(({ id }) => id === pickedId)
    ? pickedId
    : null;
  const previewedId =
    selectedId !== null && outcomes.get(selectedId)?.status !== "failed"
      ? selectedId
      : null;
  const issueGroups = useMemo<IssueGroup[]>(() => {
    if (previewedId !== null) {
      return [
        { id: previewedId, issues: outcomes.get(previewedId)?.issues ?? [] },
      ];
    }
    return cards.map(({ id, name, outcome }) => ({
      id,
      title: name,
      onSelect: () => setPickedId(id),
      issues: outcome?.issues ?? [],
    }));
  }, [previewedId, outcomes, cards]);
  const previewSensors =
    previewedId !== null
      ? (sensorsByFile.get(previewedId) ?? [])
      : merged.sensors;
  const sensorName =
    chosenSensor !== null &&
    previewSensors.some(({ name }) => name === chosenSensor)
      ? chosenSensor
      : previewSensors[0]?.name;
  const graphedSensor = previewSensors.find(({ name }) => name === sensorName);

  const isStillReading =
    pendingDrops > 0 || entries.some(({ state }) => state === "reading");
  const canImport = !isStillReading && merged.sensors.length > 0;

  const handleImport = useCallback(() => {
    if (!canImport) return;
    const skippedCount = [...outcomes.values()].reduce(
      (total, outcome) => total + (outcome?.stats?.ignored ?? 0),
      0,
    );
    importSensorData(merged.sensors, {
      skippedCount,
      hasTimingWarning: timingByFile.some((warnings) => warnings.length > 0),
      files: {
        filesCount: readEntries.length,
        zipCount: zipCount.current,
        issueCodes: [
          ...new Set(
            [...outcomes.values()].flatMap((outcome) =>
              (outcome?.issues ?? []).map(({ code }) => code),
            ),
          ),
        ],
      },
    });
    onClose();
  }, [
    canImport,
    outcomes,
    merged,
    readEntries,
    timingByFile,
    importSensorData,
    onClose,
  ]);

  return (
    <BaseDialog
      title={translate("sensorData.import.title")}
      size="xl"
      height="xl"
      isOpen={true}
      onClose={onClose}
      footer={
        <SimpleDialogActions
          action={translate("sensorData.import.importAction")}
          onAction={handleImport}
          isDisabled={!canImport}
          onClose={onClose}
          note={translate("sensorData.import.sessionNote")}
        />
      }
    >
      <div
        ref={sidebar.containerRef}
        {...dropTargetProps}
        className={clsx(
          "flex flex-1 min-h-0 overflow-hidden",
          dragState !== "idle" &&
            entries.length > 0 &&
            "ring-2 ring-inset ring-accent bg-accent-tint",
        )}
      >
        <input
          ref={fileInputRef}
          {...inputProps}
          accept={ACCEPTED_EXTENSIONS}
        />
        {entries.length === 0 ? (
          <>
            <EmptyFilesDropZone
              width={sidebar.width}
              isOver={dragState !== "idle"}
              onBrowse={openFileBrowser}
            />
            {resizer}
            <div className="flex flex-1 items-center justify-center p-4 pl-1 text-size-base text-subtle text-center">
              {translate("sensorData.import.files.empty")}
            </div>
          </>
        ) : (
          <>
            <SensorFilesPanel
              width={sidebar.width}
              files={cards}
              selectedId={selectedId}
              onToggle={handleToggle}
              onNavigate={setPickedId}
              onRemove={handleRemove}
              onAdd={openFileBrowser}
            />
            {resizer}
            <div className="flex flex-col gap-3 flex-1 min-w-0 min-h-0 p-4 pl-1 overflow-auto">
              {issueGroups.some(({ issues }) => issues.length > 0) && (
                <div className="shrink-0">
                  <ImportIssuesReport
                    key={previewedId ?? "all"}
                    groups={issueGroups}
                    translationKeys={SENSOR_DATA_IMPORT_KEYS}
                  />
                </div>
              )}
              {previewSensors.length > 0 && (
                <section className="flex flex-col gap-2 flex-1 basis-0 min-h-0">
                  <h3 className="shrink-0 text-size-base font-semibold">
                    {translate("sensorData.import.files.sensorsHeading")}{" "}
                    <span className="font-normal text-subtle">
                      ({localizeDecimal(previewSensors.length)})
                    </span>
                  </h3>
                  <SensorPreview
                    sensors={previewSensors}
                    selectedName={sensorName}
                    onSelect={setChosenSensor}
                    showReadings={false}
                  />
                </section>
              )}
              {graphedSensor && <SensorPreviewGraph sensor={graphedSensor} />}
            </div>
          </>
        )}
      </div>
    </BaseDialog>
  );
};

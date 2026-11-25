import { useCallback, useMemo, useRef } from "react";
import clsx from "clsx";
import { Button } from "src/components/elements";
import { NavigableList, type NavItem } from "src/components/list";
import { useTranslate } from "src/hooks/use-translate";
import {
  AddIcon,
  CloseIcon,
  ErrorIcon,
  FileIcon,
  UploadIcon,
  WarningIcon,
} from "src/icons";
import { RingSpinner } from "src/components/ring-spinner";
import type { ImportOutcome } from "src/components/import-outcome";
import { FormatInfo } from "./format-info";

export type SensorFileCard = {
  id: number;
  name: string;
  outcome: ImportOutcome | null;
};

const SECTION = "files";

export const SensorFilesPanel = ({
  files,
  selectedId,
  onToggle,
  onNavigate,
  onRemove,
  onAdd,
  width,
}: {
  width: number;
  files: SensorFileCard[];
  selectedId: number | null;
  onToggle: (id: number) => void;
  onNavigate: (id: number | null) => void;
  onRemove: (id: number) => void;
  onAdd: () => void;
}) => {
  const translate = useTranslate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const navItems = useMemo(
    (): NavItem[] => files.map(({ id }) => ({ id, section: SECTION })),
    [files],
  );
  const focusedItem: NavItem =
    selectedId !== null
      ? { id: selectedId, section: SECTION }
      : { section: SECTION };

  const handleSelectItem = useCallback(
    (item: NavItem) => onNavigate(item.id ?? null),
    [onNavigate],
  );

  const blockSectionToggle = (event: React.KeyboardEvent) => {
    if (
      event.key === "Enter" &&
      event.target === wrapperRef.current?.firstElementChild
    ) {
      event.stopPropagation();
    }
  };

  return (
    <div className="flex flex-col shrink-0 min-h-0" style={{ width }}>
      <div className="flex items-center gap-2 h-14 shrink-0 px-4 border-r">
        <h3 className="flex-1 text-size-base font-semibold">
          {translate("sensorData.import.files.title")}
        </h3>
        <FormatInfo />
        <Button type="button" size="sm" onClick={onAdd}>
          <AddIcon />
          {translate("sensorData.import.files.add")}
        </Button>
      </div>
      <div
        ref={wrapperRef}
        className="flex flex-col flex-1 min-h-0"
        onKeyDownCapture={blockSectionToggle}
      >
        <NavigableList
          navItems={navItems}
          focusedItem={focusedItem}
          onSelectItem={handleSelectItem}
        >
          <ul aria-label={translate("sensorData.import.files.title")}>
            {files.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                isSelected={file.id === selectedId}
                onToggle={() => onToggle(file.id)}
                onRemove={() => onRemove(file.id)}
              />
            ))}
          </ul>
        </NavigableList>
      </div>
    </div>
  );
};

const FileRow = ({
  file,
  isSelected,
  onToggle,
  onRemove,
}: {
  file: SensorFileCard;
  isSelected: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) => {
  const translate = useTranslate();
  const { outcome } = file;
  const isFailed = outcome?.status === "failed";

  return (
    <li
      data-item-id={file.id}
      aria-selected={isSelected}
      className={clsx(
        "group flex items-start gap-1 rounded-base",
        isSelected && "bg-accent-tint",
        !isSelected && isFailed && "bg-error-subtle",
        !isSelected && !isFailed && "hover:bg-base-hover",
      )}
    >
      <button
        type="button"
        className="flex flex-1 items-start gap-2 min-w-0 px-2 py-1.5 rounded-base text-left focus:outline-hidden"
        onClick={onToggle}
        aria-pressed={isSelected}
      >
        <FileStatusIcon outcome={outcome} />
        <span className="flex flex-col min-w-0">
          <span
            className="text-size-base text-default truncate"
            title={file.name}
          >
            {file.name}
          </span>
          <span className="text-xs text-subtle break-words">
            <FileSummary outcome={outcome} />
          </span>
        </span>
      </button>
      <button
        type="button"
        className={clsx(
          "shrink-0 mt-1.5 mr-1 p-0.5 rounded-base text-subtle hover:text-default hover:bg-base-hover focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent",
          isSelected ? "visible" : "invisible group-hover:visible",
        )}
        onClick={onRemove}
        aria-label={translate("sensorData.import.removeFile")}
      >
        <CloseIcon />
      </button>
    </li>
  );
};

const FileStatusIcon = ({ outcome }: { outcome: ImportOutcome | null }) => {
  const className = "h-4 w-4 mt-0.5 shrink-0";
  if (!outcome) return <RingSpinner size="sm" />;
  if (outcome.status === "failed")
    return <ErrorIcon className={clsx(className, "text-error")} aria-hidden />;
  if (outcome.status === "warning")
    return (
      <WarningIcon className={clsx(className, "text-warning")} aria-hidden />
    );
  return <FileIcon className={clsx(className, "text-subtle")} aria-hidden />;
};

const FileSummary = ({ outcome }: { outcome: ImportOutcome | null }) => {
  const translate = useTranslate();
  if (!outcome) return translate("sensorData.import.files.reading");
  if (outcome.status === "failed" || !outcome.stats) {
    return <span className="text-error">{outcome.message}</span>;
  }

  const { added, ignored } = outcome.stats;
  const sensors = translate("sensorData.import.files.sensors", added);
  if (ignored === 0) return sensors;
  const skipped = (
    <span className="text-warning">
      {translate("sensorData.import.ignored", String(ignored))}
    </span>
  );
  if (added === 0) return skipped;
  return (
    <>
      {sensors}
      {" · "}
      {skipped}
    </>
  );
};

export const EmptyFilesDropZone = ({
  isOver,
  onBrowse,
  width,
}: {
  width: number;
  isOver: boolean;
  onBrowse: () => void;
}) => {
  const translate = useTranslate();

  return (
    <div className="flex shrink-0 p-4 border-r" style={{ width }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onBrowse}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onBrowse();
          }
        }}
        className={clsx(
          "flex flex-1 flex-col items-center justify-center gap-3 p-4 border-2 border-dashed rounded-card text-center cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent",
          isOver
            ? "border-accent bg-accent-tint"
            : "border-strong bg-panel hover:bg-base-hover",
        )}
        data-testid="sensor-data-drop-zone"
      >
        <span className="p-3 rounded-full bg-track">
          <UploadIcon
            className={clsx("h-6 w-6", isOver ? "text-accent" : "text-subtle")}
          />
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-size-base font-medium text-default">
            {translate("dropZone.defaultText")}
          </span>
          <span className="text-xs text-subtle">
            {translate("dropZone.supportedFormats", "CSV, XLSX, ZIP")}
          </span>
          <span
            className="flex justify-center text-xs text-subtle"
            onClick={(event) => event.stopPropagation()}
          >
            <FormatInfo variant="link" />
          </span>
        </span>
        <Button type="button" variant="primary" size="sm" tabIndex={-1}>
          {translate("sensorData.import.files.select")}
        </Button>
      </div>
    </div>
  );
};

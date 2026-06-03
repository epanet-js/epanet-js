import React, { useCallback, useMemo, useRef } from "react";
import { useDropZone } from "src/hooks/use-drop-zone";
import { useTranslate } from "src/hooks/use-translate";
import { UploadIcon, CloseIcon } from "src/icons";

export type GisFormat = "geojson" | "geojsonl" | "shapefile";

export interface GisFiles {
  shp?: File;
  shx?: File;
  prj?: File;
  cpg?: File;
  dbf?: File;
  geojson?: File;
  geojsonl?: File;
}

interface GisDropZoneProps {
  onFileDrop: (gisFiles: GisFiles) => void;
  onFileRejected?: (file: File, reason: string) => void;
  disabled?: boolean;
  supportedFormats?: GisFormat[];
  selectedFiles?: GisFiles;
  testId?: string;
}

const DEFAULT_FORMATS: GisFormat[] = ["geojson", "geojsonl", "shapefile"];

const SHAPEFILE_EXTENSIONS = [".shp", ".shx", ".prj", ".cpg", ".dbf"];

const FORMAT_EXTENSIONS: Record<GisFormat, string[]> = {
  geojson: [".geojson"],
  geojsonl: [".geojsonl"],
  shapefile: SHAPEFILE_EXTENSIONS,
};

const getAcceptString = (formats: GisFormat[]): string =>
  formats.flatMap((f) => FORMAT_EXTENSIONS[f]).join(",");

const getFormatLabel = (formats: GisFormat[]): string =>
  formats
    .map((f) => {
      if (f === "geojson") return "GeoJSON";
      if (f === "geojsonl") return "GeoJSONL";
      return "Shapefile";
    })
    .join(", ");

const GIS_FILE_EXTENSIONS: Record<string, keyof GisFiles> = {
  ".geojson": "geojson",
  ".geojsonl": "geojsonl",
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

const isFileAcceptedByFormats = (file: File, formats: GisFormat[]): boolean => {
  const name = file.name.toLowerCase();
  const allExtensions = formats.flatMap((f) => FORMAT_EXTENSIONS[f]);
  return allExtensions.some((ext) => name.endsWith(ext));
};

const FILE_LIST_ORDER: (keyof GisFiles)[] = [
  "geojson",
  "geojsonl",
  "shp",
  "shx",
  "dbf",
  "cpg",
  "prj",
];

const getFileEntries = (
  files: GisFiles,
): { key: keyof GisFiles; file: File }[] =>
  FILE_LIST_ORDER.filter((key) => files[key] != null).map((key) => ({
    key,
    file: files[key]!,
  }));

const SelectedFileList = ({
  files,
  onRemove,
}: {
  files: GisFiles;
  onRemove: (key: keyof GisFiles) => void;
}) => {
  const translate = useTranslate();
  const entries = getFileEntries(files);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {entries.map(({ key, file }) => (
        <div
          key={key}
          className="flex items-center gap-2 bg-base rounded-md px-3 py-1.5 border shadow-xs"
        >
          <p className="text-size-base text-default truncate font-medium">
            {file.name}
          </p>
          <p className="text-size-small text-subtle truncate flex-1">
            {translate(`dropZone.fileDescriptions.${key}`)}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(key);
            }}
            className="shrink-0 p-0.5 rounded hover:bg-base-hover text-subtle hover:text-default"
            aria-label={`Remove ${file.name}`}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export const GisDropZone: React.FC<GisDropZoneProps> = ({
  onFileDrop,
  onFileRejected,
  disabled = false,
  supportedFormats = DEFAULT_FORMATS,
  selectedFiles,
  testId = "gis-drop-zone",
}) => {
  const translate = useTranslate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const accept = useMemo(
    () => getAcceptString(supportedFormats),
    [supportedFormats],
  );

  const handleFiles = useCallback(
    (incomingFiles: File[]) => {
      const updated: GisFiles = { ...selectedFiles };
      let hasNew = false;

      for (const file of incomingFiles) {
        if (!isFileAcceptedByFormats(file, supportedFormats)) {
          onFileRejected?.(file, "format");
          continue;
        }
        const key = getGisFileKey(file);
        if (key) {
          updated[key] = file;
          hasNew = true;
        }
      }

      if (hasNew) {
        onFileDrop(updated);
      }
    },
    [supportedFormats, selectedFiles, onFileDrop, onFileRejected],
  );

  const handleSingleFile = useCallback(
    (file: File) => handleFiles([file]),
    [handleFiles],
  );

  const { dragState, dropZoneProps } = useDropZone({
    onFileDrop: handleSingleFile,
    onFileRejected,
    accept,
    disabled,
    multiple: true,
  });

  const handleDropZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled || !e.target.files) return;
      handleFiles(Array.from(e.target.files));
      e.target.value = "";
    },
    [disabled, handleFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer?.files
        ? Array.from(e.dataTransfer.files)
        : [];
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [disabled, handleFiles],
  );

  const handleRemoveFile = useCallback(
    (key: keyof GisFiles) => {
      const updated = { ...selectedFiles };
      delete updated[key];
      onFileDrop(updated);
    },
    [selectedFiles, onFileDrop],
  );

  const hasFiles = selectedFiles
    ? Object.values(selectedFiles).some(Boolean)
    : false;
  const formatLabel = getFormatLabel(supportedFormats);

  return (
    <div className="flex flex-col gap-3" data-testid={testId}>
      <div
        {...dropZoneProps}
        onDrop={handleDrop}
        onClick={handleDropZoneClick}
        className={`
          min-h-[200px] border-2 border-dashed rounded-lg
          flex flex-col items-center justify-center p-8 cursor-pointer
          transition-all duration-200 ease-in-out
          ${dragState === "idle" ? "border-strong bg-panel hover:border-gray-400 hover:bg-base-hover" : ""}
          ${dragState === "dragging" ? "border-purple-400 bg-accent-tint" : ""}
          ${dragState === "over" ? "border-purple-500 border-solid bg-purple-100" : ""}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          disabled={disabled}
          onChange={handleInputChange}
          className="sr-only"
          id="gis-file-input"
        />

        <div className="flex flex-col items-center space-y-4">
          <div
            className={`
            p-3 rounded-full
            ${dragState === "over" ? "bg-purple-200" : "bg-base-active"}
          `}
          >
            <UploadIcon
              className={`h-8 w-8 ${
                dragState === "over" ? "text-accent-hover" : "text-subtle"
              }`}
            />
          </div>

          <div className="text-center">
            <p
              className={`text-size-heading-3 font-medium ${
                dragState === "over" ? "text-accent" : "text-default"
              }`}
            >
              {dragState === "over"
                ? translate("dropZone.activeText")
                : translate("dropZone.defaultText")}
            </p>

            <p className="text-size-base text-subtle mt-2">
              {translate("dropZone.supportedFormats", formatLabel)}
            </p>
          </div>
        </div>
      </div>

      {hasFiles && selectedFiles && (
        <SelectedFileList files={selectedFiles} onRemove={handleRemoveFile} />
      )}
    </div>
  );
};

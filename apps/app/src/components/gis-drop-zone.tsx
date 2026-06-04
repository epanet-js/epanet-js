import React, { useCallback, useMemo, useRef } from "react";
import { useDropZone } from "src/hooks/use-drop-zone";
import { useTranslate } from "src/hooks/use-translate";
import { UploadIcon, CloseIcon, CheckIcon } from "src/icons";

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

const getBaseName = (files: GisFiles): string => {
  const file = Object.values(files).find(Boolean) as File | undefined;
  if (!file) return "";
  const name = file.name;
  const dotIndex = name.lastIndexOf(".");
  return dotIndex > 0 ? name.substring(0, dotIndex) : name;
};

const getFileGroupType = (
  files: GisFiles,
): "geojson" | "geojsonl" | "shapefile" => {
  if (files.geojson) return "geojson";
  if (files.geojsonl) return "geojsonl";
  return "shapefile";
};

const PRIMARY_EXTENSION: Record<ReturnType<typeof getFileGroupType>, string> = {
  geojson: ".geojson",
  geojsonl: ".geojsonl",
  shapefile: ".shp",
};

const getDisplayName = (files: GisFiles): string => {
  const baseName = getBaseName(files);
  const ext = PRIMARY_EXTENSION[getFileGroupType(files)];
  return baseName + ext;
};

const Badge = ({
  label,
  variant,
}: {
  label: string;
  variant: "green" | "gray";
}) => (
  <span
    className={`px-2 py-0.5 rounded text-xs ${
      variant === "green"
        ? "bg-green-100 text-green-700"
        : "bg-gray-100 text-gray-700"
    }`}
  >
    {label}
  </span>
);

const SHAPEFILE_REQUIRED_BADGES: { key: keyof GisFiles; label: string }[] = [
  { key: "shp", label: "SHP" },
  { key: "dbf", label: "DBF" },
  { key: "prj", label: "PRJ" },
];

const SHAPEFILE_OPTIONAL_BADGES: { key: keyof GisFiles; label: string }[] = [
  { key: "shx", label: "SHX" },
  { key: "cpg", label: "CPG" },
];

const SHAPEFILE_WAITING: { key: keyof GisFiles; translationKey: string }[] = [
  { key: "shp", translationKey: "dropZone.waiting.shp" },
  { key: "dbf", translationKey: "dropZone.waiting.dbf" },
  { key: "prj", translationKey: "dropZone.waiting.prj" },
];

const SelectedFileList = ({
  files,
  onRemove,
}: {
  files: GisFiles;
  onRemove: () => void;
}) => {
  const translate = useTranslate();
  const hasFiles = Object.values(files).some(Boolean);
  if (!hasFiles) return null;

  const groupType = getFileGroupType(files);
  const displayName = getDisplayName(files);

  const waitingMessage =
    groupType === "shapefile"
      ? SHAPEFILE_WAITING.find(({ key }) => !files[key])
      : undefined;

  return (
    <div className="relative p-3 bg-base rounded-md border border-gray-200">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-2 right-2 p-0.5 rounded hover:bg-base-hover text-subtle hover:text-default"
        aria-label="Remove files"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
      <div className="flex flex-col gap-1 pr-6">
        <span className="text-size-base text-default truncate font-medium">
          {displayName}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {groupType === "geojson" && <Badge label="GEOJSON" variant="green" />}
          {groupType === "geojsonl" && (
            <Badge label="GEOJSONL" variant="green" />
          )}
          {groupType === "shapefile" && (
            <>
              {SHAPEFILE_REQUIRED_BADGES.map(({ key, label }) => (
                <Badge
                  key={key}
                  label={label}
                  variant={files[key] ? "green" : "gray"}
                />
              ))}
              {SHAPEFILE_OPTIONAL_BADGES.map(
                ({ key, label }) =>
                  files[key] && (
                    <Badge key={key} label={label} variant="green" />
                  ),
              )}
            </>
          )}
        </div>
        {groupType === "shapefile" &&
          (waitingMessage ? (
            <span className="flex items-center gap-1 mt-1 text-xs text-slate-600">
              {translate(waitingMessage.translationKey)}
            </span>
          ) : (
            <span className="flex items-center gap-1 mt-1 text-xs text-green-700">
              <CheckIcon className="h-3 w-3" />
              {translate("dropZone.shapefileReady")}
            </span>
          ))}
      </div>
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

  const handleRemoveFile = useCallback(() => {
    onFileDrop({});
  }, [onFileDrop]);

  const hasFiles = selectedFiles
    ? Object.values(selectedFiles).some(Boolean)
    : false;
  const formatLabel = getFormatLabel(supportedFormats);

  return (
    <div className="flex flex-col gap-3" data-testid={testId}>
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

      {hasFiles && selectedFiles ? (
        <>
          <button
            type="button"
            onClick={handleDropZoneClick}
            disabled={disabled}
            className={`
              w-full text-center px-4 py-2 text-sm font-medium text-white rounded
              cursor-pointer transition-colors flex items-center justify-center gap-2
              bg-accent hover:bg-accent-hover
              ${disabled ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            <UploadIcon className="h-4 w-4" />
            <span>{translate("dropZone.addMoreFiles", formatLabel)}</span>
          </button>
          <SelectedFileList files={selectedFiles} onRemove={handleRemoveFile} />
        </>
      ) : (
        <div
          {...dropZoneProps}
          onDrop={handleDrop}
          onClick={handleDropZoneClick}
          className={`
            min-h-[100px] border-2 border-dashed rounded-lg
            flex flex-col items-center justify-center p-8 cursor-pointer
            transition-all duration-200 ease-in-out
            ${dragState === "idle" ? "border-strong bg-panel hover:border-gray-400 hover:bg-base-hover" : ""}
            ${dragState === "dragging" ? "border-purple-400 bg-accent-tint" : ""}
            ${dragState === "over" ? "border-purple-500 border-solid bg-purple-100" : ""}
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
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
      )}
    </div>
  );
};

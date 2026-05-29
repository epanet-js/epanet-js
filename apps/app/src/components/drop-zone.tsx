import React, { useCallback, useRef } from "react";
import { useDropZone } from "src/hooks/use-drop-zone";
import { useTranslate } from "src/hooks/use-translate";
import { UploadIcon } from "src/icons";

interface DropZoneProps {
  onFileDrop: (file: File) => void;
  onFileRejected?: (file: File, reason: string) => void;
  accept?: string;
  disabled?: boolean;
  supportedFormats?: string;
  selectedFile?: File | null;
  testId?: string;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFileDrop,
  onFileRejected,
  accept,
  disabled = false,
  supportedFormats,
  selectedFile,
  testId = "drop-zone",
}) => {
  const translate = useTranslate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { dragState, dropZoneProps, inputProps } = useDropZone({
    onFileDrop,
    onFileRejected,
    accept,
    disabled,
  });

  const handleDropZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div
      {...dropZoneProps}
      onClick={handleDropZoneClick}
      className={`
        relative min-h-[200px] border-2 border-dashed rounded-lg
        flex flex-col items-center justify-center p-8 cursor-pointer
        transition-all duration-200 ease-in-out
        ${dragState === "idle" ? "border-strong bg-panel hover:border-gray-400 hover:bg-base-hover" : ""}
        ${dragState === "dragging" ? "border-purple-400 bg-purple-50" : ""}
        ${dragState === "over" ? "border-purple-500 border-solid bg-purple-100" : ""}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
      data-testid={testId}
    >
      <input ref={fileInputRef} {...inputProps} id="file-input" />

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

          {supportedFormats && (
            <p className="text-size-base text-subtle mt-2">
              {translate("dropZone.supportedFormats", supportedFormats)}
            </p>
          )}
        </div>
      </div>

      {selectedFile && (
        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-base rounded-md px-3 py-2 border shadow-xs">
            <p className="text-size-base text-subtle truncate">
              {translate("dropZone.selectedFile", selectedFile.name)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

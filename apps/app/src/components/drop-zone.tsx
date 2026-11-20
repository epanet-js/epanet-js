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
  formatHelp?: React.ReactNode;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFileDrop,
  onFileRejected,
  accept,
  disabled = false,
  supportedFormats,
  selectedFile,
  testId = "drop-zone",
  formatHelp,
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

  const content = (help: React.ReactNode) => (
    <div className="flex flex-col items-center space-y-4">
      <div
        className={`
        p-3 rounded-full
        ${dragState === "over" ? "bg-purple-200" : "bg-track"}
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
          <div className="flex items-center justify-center gap-1 mt-2 text-size-base text-subtle">
            <p>{translate("dropZone.supportedFormats", supportedFormats)}</p>
            {help}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative">
      <div
        {...dropZoneProps}
        onClick={handleDropZoneClick}
        className={`
          relative min-h-[200px] border-2 border-dashed rounded-card
          flex flex-col items-center justify-center p-8 cursor-pointer
          transition-all duration-200 ease-in-out
          ${dragState === "idle" ? "border-strong bg-panel hover:border-gray-400 hover:bg-base-hover" : ""}
          ${dragState === "dragging" ? "border-purple-400 bg-accent-tint" : ""}
          ${dragState === "over" ? "border-purple-500 border-solid bg-purple-100" : ""}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
        data-testid={testId}
      >
        <input ref={fileInputRef} {...inputProps} id="file-input" />

        {content(
          formatHelp ? (
            <span className="flex invisible">{formatHelp}</span>
          ) : null,
        )}

        {selectedFile && (
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-base rounded-base px-3 py-2 border shadow-xs">
              <p className="text-size-base text-subtle truncate">
                {translate("dropZone.selectedFile", selectedFile.name)}
              </p>
            </div>
          </div>
        )}
      </div>

      {formatHelp && (
        <div className="absolute inset-0 border-2 border-transparent p-8 flex flex-col items-center justify-center invisible pointer-events-none">
          {content(
            <span className="flex visible pointer-events-auto">
              {formatHelp}
            </span>,
          )}
        </div>
      )}
    </div>
  );
};

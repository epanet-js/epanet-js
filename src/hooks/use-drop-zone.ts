import { useState, useCallback } from "react";
import { getFilesFromDataTransferItems } from "@placemarkio/flat-drop-files";

type DragState = "idle" | "dragging" | "over";

interface UseDropZoneOptions {
  onFileDrop: (file: File) => void;
  accept?: string;
  disabled?: boolean;
  multiple?: boolean;
}

interface UseDropZoneReturn {
  dragState: DragState;
  dropZoneProps: React.HTMLAttributes<HTMLDivElement>;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
}

export const useDropZone = ({
  onFileDrop,
  accept,
  disabled = false,
  multiple = false,
}: UseDropZoneOptions): UseDropZoneReturn => {
  const [dragState, setDragState] = useState<DragState>("idle");

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setDragState("over");
    },
    [disabled],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();

      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setDragState("idle");
      }
    },
    [disabled],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setDragState("over");
    },
    [disabled],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setDragState("idle");

      try {
        const files = e.dataTransfer?.items
          ? await getFilesFromDataTransferItems(e.dataTransfer.items)
          : [];

        if (files.length > 0) {
          const file = files[0] as File;

          if (accept && !isFileAccepted(file, accept)) {
            return;
          }

          onFileDrop(file);
        }
      } catch (error) {}
    },
    [disabled, accept, onFileDrop],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      const file = e.target.files?.[0];
      if (file) {
        onFileDrop(file);
      }
    },
    [disabled, onFileDrop],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
    },
    [disabled],
  );

  const dropZoneProps: React.HTMLAttributes<HTMLDivElement> = {
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
    onClick: handleClick,
    role: "button",
    tabIndex: disabled ? -1 : 0,
    "aria-label": "Drop files here or click to browse",
  };

  const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {
    type: "file",
    accept,
    multiple,
    disabled,
    onChange: handleFileInputChange,
    className: "sr-only",
  };

  return {
    dragState,
    dropZoneProps,
    inputProps,
  };
};

const isFileAccepted = (file: File, accept: string): boolean => {
  const acceptTypes = accept.split(",").map((type) => type.trim());

  return acceptTypes.some((acceptType) => {
    if (acceptType.startsWith(".")) {
      return file.name.toLowerCase().endsWith(acceptType.toLowerCase());
    } else if (acceptType.includes("*")) {
      const regex = new RegExp(acceptType.replace("*", ".*"));
      return regex.test(file.type);
    } else {
      return file.type === acceptType;
    }
  });
};

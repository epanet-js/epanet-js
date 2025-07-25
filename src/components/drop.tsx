import { useState, useEffect } from "react";
import { captureError } from "src/infra/error-tracking";
import { getFilesFromDataTransferItems } from "@placemarkio/flat-drop-files";
import type { FileWithHandle } from "browser-fs-access";
import { StyledDropOverlay } from "./elements";
import { useTranslate } from "src/hooks/use-translate";
import { useImportInp } from "src/commands/import-inp";
import { useUserTracking } from "src/infra/user-tracking";
import { useUnsavedChangesCheck } from "src/commands/check-unsaved-changes";
import { useAtomValue } from "jotai";
import { dialogAtom } from "src/state/dialog";

/**
 * From an event, get files, with handles for re-saving.
 * Result is nullable.
 */

const stopWindowDrag = (event: DragEvent) => {
  event.preventDefault();
};

const getFileExtension = (filename: string): string | null => {
  const parts = filename.split(".");
  if (parts.length > 1) {
    const extension = parts[parts.length - 1];
    return extension.toLowerCase();
  }
  return null;
};

const Drop = () => {
  const translate = useTranslate();
  const [dragging, setDragging] = useState<boolean>(false);
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const importInp = useImportInp();
  const userTracking = useUserTracking();
  const dialog = useAtomValue(dialogAtom);

  useEffect(() => {
    window.addEventListener("dragover", stopWindowDrag);
    window.addEventListener("drop", stopWindowDrag);

    return () => {
      window.removeEventListener("dragover", stopWindowDrag);
      window.removeEventListener("drop", stopWindowDrag);
    };
  }, []);

  useEffect(() => {
    if (dialog && dialog.type !== "welcome") {
      return;
    }

    const onDropFiles = (files: FileWithHandle[]) => {
      if (!files.length) return;

      userTracking.capture({
        name: "files.dropped",
        filenames: files.map((f) => f.name),
        extensions: files.map((f) => getFileExtension(f.name)),
        count: files.length,
      });
      checkUnsavedChanges(() => importInp(files));
    };

    const onDragEnter = () => {
      setDragging(true);
    };

    const onDragLeave = (event: DragEvent) => {
      if (!event.relatedTarget) {
        setDragging(false);
        return;
      }
      const portals = document.querySelectorAll("[data-radix-portal]");
      for (const portal of portals) {
        if (
          event.relatedTarget instanceof Node &&
          portal.contains(event.relatedTarget)
        ) {
          setDragging(false);
          return;
        }
      }
    };

    const onDrop = async (event: DragEvent) => {
      setDragging(false);
      const files = event.dataTransfer?.items
        ? await getFilesFromDataTransferItems(event.dataTransfer.items)
        : [];
      onDropFiles(files);
      event.preventDefault();
    };

    const onDropCaught = (event: DragEvent) => {
      onDrop(event).catch((e) => captureError(e));
    };

    document.addEventListener("dragenter", onDragEnter);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDropCaught);

    return () => {
      document.removeEventListener("dragenter", onDragEnter);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDropCaught);
    };
  }, [setDragging, checkUnsavedChanges, importInp, userTracking, dialog]);

  if (dialog && dialog.type !== "welcome") return null;

  return dragging ? (
    <StyledDropOverlay>{translate("dropInp")}</StyledDropOverlay>
  ) : null;
};

export default Drop;

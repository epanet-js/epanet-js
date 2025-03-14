import { useState, useEffect } from "react";
import { captureError } from "src/infra/error-tracking";
import { getFilesFromDataTransferItems } from "@placemarkio/flat-drop-files";
import type { FileWithHandle } from "browser-fs-access";
import { StyledDropOverlay } from "./elements";
import { translate } from "src/infra/i18n";
import { useImportInp } from "src/commands/open-inp";
import { useUserTracking } from "src/infra/user-tracking";
import { useUnsavedChangesCheck } from "src/commands/check-unsaved-changes";

/**
 * From an event, get files, with handles for re-saving.
 * Result is nullable.
 */

const stopWindowDrag = (event: DragEvent) => {
  event.preventDefault();
};

const Drop = () => {
  const [dragging, setDragging] = useState<boolean>(false);
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const importInp = useImportInp();
  const userTracking = useUserTracking();

  useEffect(() => {
    const onDropFiles = (files: FileWithHandle[]) => {
      if (!files.length) return;
      userTracking.capture({ name: "openModel.started", source: "drop" });
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
    window.addEventListener("dragover", stopWindowDrag);
    window.addEventListener("drop", stopWindowDrag);

    return () => {
      document.removeEventListener("dragenter", onDragEnter);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDropCaught);
      window.removeEventListener("dragover", stopWindowDrag);
      window.removeEventListener("drop", stopWindowDrag);
    };
  }, [setDragging, checkUnsavedChanges, importInp, userTracking]);

  return dragging ? (
    <StyledDropOverlay>{translate("dropInp")}</StyledDropOverlay>
  ) : null;
};

export default Drop;

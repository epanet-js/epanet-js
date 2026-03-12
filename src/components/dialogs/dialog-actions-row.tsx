import { useTranslate } from "src/hooks/use-translate";
import { Button } from "../elements";
import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import { useDialogState } from "../dialog";

export interface DialogActionsHandle {
  closeDialog: () => void;
  saveDialog: () => void;
}

export const DialogActions = forwardRef<
  DialogActionsHandle,
  {
    onSave?: (hasWarnings: boolean) => void;
    onClose?: (hasChanges: boolean) => void;
    hasChanges?: boolean;
    hasWarnings?: boolean;
    readOnly?: boolean;
  }
>(
  (
    {
      onSave,
      onClose,
      hasChanges = false,
      hasWarnings = false,
      readOnly = false,
    },
    ref,
  ) => {
    const { closeDialog } = useDialogState();
    const translate = useTranslate();

    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const [showSaveWarning, setShowSaveWarning] = useState(false);

    const handleSave = useCallback(() => {
      if (hasWarnings && !showSaveWarning) {
        return setShowSaveWarning(true);
      }
      if (!hasChanges) {
        onClose?.(false);
        return closeDialog();
      }
      onSave?.(hasWarnings);
      closeDialog();
    }, [
      hasWarnings,
      showSaveWarning,
      hasChanges,
      onSave,
      closeDialog,
      onClose,
    ]);

    const handleClose = useCallback(() => {
      if (hasChanges && !showDiscardConfirm) {
        return setShowDiscardConfirm(true);
      }
      if (!hasChanges) {
        onClose?.(false);
        return closeDialog();
      }
      onClose?.(hasChanges);
      closeDialog();
    }, [hasChanges, closeDialog, showDiscardConfirm, onClose]);

    const handleKeepEditing = useCallback(() => {
      setShowDiscardConfirm(false);
      setShowSaveWarning(false);
    }, [setShowDiscardConfirm, setShowSaveWarning]);

    useImperativeHandle(ref, () => ({
      closeDialog: handleClose,
      saveDialog: handleSave,
    }));

    if (readOnly)
      return (
        <div className="mt-6 flex flex-row-reverse gap-x-3 items-end h-8">
          <Button type="button" onClick={handleClose}>
            {translate("dialog.close")}
          </Button>
        </div>
      );

    if (showDiscardConfirm)
      return (
        <div className="mt-6 flex flex-row-reverse gap-x-3 items-end h-8">
          <Button
            type="button"
            variant="danger"
            onClick={handleClose}
            className="whitespace-nowrap"
          >
            {translate("dialog.discardChanges")}
          </Button>
          <Button
            type="button"
            onClick={handleKeepEditing}
            className="whitespace-nowrap"
          >
            {translate("dialog.keepEditing")}
          </Button>
          <span className="text-sm text-gray-600 self-center">
            {translate("dialog.discardWithunsavedChangesHint")}
          </span>
        </div>
      );

    if (showSaveWarning)
      return (
        <div className="mt-6 flex flex-row-reverse gap-x-3 items-end h-8">
          <Button
            type="button"
            variant="danger"
            onClick={handleSave}
            className="whitespace-nowrap"
          >
            {translate("dialog.save")}
          </Button>
          <Button
            type="button"
            onClick={handleKeepEditing}
            className="whitespace-nowrap"
          >
            {translate("dialog.keepEditing")}
          </Button>
          <span className="text-sm text-gray-600 self-center">
            {translate("dialog.saveWithWarningsHint")}
          </span>
        </div>
      );

    return (
      <div className="mt-6 flex flex-row-reverse gap-x-3 items-end h-8">
        <Button
          type="button"
          variant="primary"
          onClick={handleSave}
          disabled={!hasChanges}
        >
          {translate("dialog.save")}
        </Button>
        <Button type="button" onClick={handleClose}>
          {translate("dialog.cancel")}
        </Button>
      </div>
    );
  },
);

const FooterWrapper = ({ children }: { children: React.ReactNode }) => (
  <footer className="relative flex flex-col sm:items-center sm:flex-row-reverse gap-3 px-4 py-3 border-t border-gray-200">
    {children}
  </footer>
);

export const DialogActionsNew = forwardRef<
  DialogActionsHandle,
  {
    onSave?: (hasWarnings: boolean) => void;
    onClose?: (hasChanges: boolean) => void;
    hasChanges?: boolean;
    hasWarnings?: boolean;
    readOnly?: boolean;
  }
>(
  (
    {
      onSave,
      onClose,
      hasChanges = false,
      hasWarnings = false,
      readOnly = false,
    },
    ref,
  ) => {
    const { closeDialog } = useDialogState();
    const translate = useTranslate();

    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const [showSaveWarning, setShowSaveWarning] = useState(false);

    const handleSave = useCallback(() => {
      if (hasWarnings && !showSaveWarning) {
        return setShowSaveWarning(true);
      }
      if (!hasChanges) {
        onClose?.(false);
        return closeDialog();
      }
      onSave?.(hasWarnings);
      closeDialog();
    }, [
      hasWarnings,
      showSaveWarning,
      hasChanges,
      onSave,
      closeDialog,
      onClose,
    ]);

    const handleClose = useCallback(() => {
      if (hasChanges && !showDiscardConfirm) {
        return setShowDiscardConfirm(true);
      }
      if (!hasChanges) {
        onClose?.(false);
        return closeDialog();
      }
      onClose?.(hasChanges);
      closeDialog();
    }, [hasChanges, closeDialog, showDiscardConfirm, onClose]);

    const handleKeepEditing = useCallback(() => {
      setShowDiscardConfirm(false);
      setShowSaveWarning(false);
    }, []);

    useImperativeHandle(ref, () => ({
      closeDialog: handleClose,
      saveDialog: handleSave,
    }));

    if (readOnly)
      return (
        <FooterWrapper>
          <Button type="button" onClick={handleClose}>
            {translate("dialog.close")}
          </Button>
        </FooterWrapper>
      );

    if (showDiscardConfirm)
      return (
        <FooterWrapper>
          <Button
            type="button"
            variant="danger"
            onClick={handleClose}
            className="whitespace-nowrap"
          >
            {translate("dialog.discardChanges")}
          </Button>
          <Button
            type="button"
            onClick={handleKeepEditing}
            className="whitespace-nowrap"
          >
            {translate("dialog.keepEditing")}
          </Button>
          <span className="text-sm text-gray-600 self-center">
            {translate("dialog.discardWithunsavedChangesHint")}
          </span>
        </FooterWrapper>
      );

    if (showSaveWarning)
      return (
        <FooterWrapper>
          <Button
            type="button"
            variant="danger"
            onClick={handleSave}
            className="whitespace-nowrap"
          >
            {translate("dialog.save")}
          </Button>
          <Button
            type="button"
            onClick={handleKeepEditing}
            className="whitespace-nowrap"
          >
            {translate("dialog.keepEditing")}
          </Button>
          <span className="text-sm text-gray-600 self-center">
            {translate("dialog.saveWithWarningsHint")}
          </span>
        </FooterWrapper>
      );

    return (
      <FooterWrapper>
        <Button
          type="button"
          variant="primary"
          onClick={handleSave}
          disabled={!hasChanges}
        >
          {translate("dialog.save")}
        </Button>
        <Button type="button" onClick={handleClose}>
          {translate("dialog.cancel")}
        </Button>
      </FooterWrapper>
    );
  },
);

import React from "react";
import {
  BaseDialog,
  DialogContainer,
  useDialogState,
} from "src/components/dialog";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

interface WizardContainerProps {
  children: React.ReactNode;
  footer?: React.ReactNode;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export const WizardContainer: React.FC<WizardContainerProps> = ({
  children,
  footer,
  onDragOver,
  onDrop,
}) => {
  const isModalsOn = useFeatureFlag("FLAG_MODALS");
  const { closeDialog } = useDialogState();

  if (isModalsOn) {
    return (
      <BaseDialog
        size="lg"
        height="xl"
        isOpen={true}
        onClose={closeDialog}
        preventClose={true}
        footer={footer}
      >
        <div
          onDragOver={onDragOver}
          onDrop={onDrop}
          className="flex flex-col h-full"
        >
          {children}
        </div>
      </BaseDialog>
    );
  }

  return (
    <DialogContainer size="lg" height="lg" disableOutsideClick={true}>
      <div
        onDragOver={onDragOver}
        onDrop={onDrop}
        className="flex flex-col h-full"
      >
        {children}
        {footer}
      </div>
    </DialogContainer>
  );
};

import React from "react";
import { BaseDialog, useDialogState } from "src/components/dialog";

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
  const { closeDialog } = useDialogState();

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
};

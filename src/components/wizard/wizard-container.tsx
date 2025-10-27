import React from "react";
import { DialogContainer, OldDialogContainer } from "src/components/dialog";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

interface WizardContainerProps {
  children: React.ReactNode;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export const WizardContainer: React.FC<WizardContainerProps> = ({
  children,
  onDragOver,
  onDrop,
}) => {
  const isModalLayoutEnabled = useFeatureFlag("FLAG_MODAL_LAYOUT");
  return isModalLayoutEnabled ? (
    <DialogContainer size="customerpoints" disableOutsideClick={true}>
      <div
        onDragOver={onDragOver}
        onDrop={onDrop}
        className="flex flex-col h-full"
      >
        {children}
      </div>
    </DialogContainer>
  ) : (
    <OldDialogContainer size="lg" disableOutsideClick={true}>
      <div className="flex flex-col h-full">{children}</div>
    </OldDialogContainer>
  );
};

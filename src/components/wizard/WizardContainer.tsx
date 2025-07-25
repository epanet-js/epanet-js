import React from "react";
import { DialogContainer } from "src/components/dialog";

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
  return (
    <DialogContainer size="lg">
      <div className="p-6" onDragOver={onDragOver} onDrop={onDrop}>
        {children}
      </div>
    </DialogContainer>
  );
};

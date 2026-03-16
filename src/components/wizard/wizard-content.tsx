import React from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

interface WizardContentProps {
  children: React.ReactNode;
  minHeight?: string;
}

export const WizardContent: React.FC<WizardContentProps> = ({
  children,
  minHeight = "300px",
}) => {
  const isModalsOn = useFeatureFlag("FLAG_MODALS");

  return (
    <div
      className={`flex flex-col flex-grow min-h-[${minHeight}] ${isModalsOn ? "px-4" : ""} overflow-hidden`}
    >
      {children}
    </div>
  );
};

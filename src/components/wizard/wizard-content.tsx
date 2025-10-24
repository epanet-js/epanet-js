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
  const isModalLayoutEnabled = useFeatureFlag("FLAG_MODAL_LAYOUT");
  return isModalLayoutEnabled ? (
    <div
      className={`overflow-y-auto flex flex-col flex-grow min-h-[${minHeight}]`}
    >
      {children}
    </div>
  ) : (
    <div className={`min-h-[${minHeight}]`}>{children}</div>
  );
};

import React from "react";

interface WizardContentProps {
  children: React.ReactNode;
  minHeight?: string;
}

export const WizardContent: React.FC<WizardContentProps> = ({
  children,
  minHeight = "300px",
}) => {
  return <div className={`min-h-[${minHeight}]`}>{children}</div>;
};

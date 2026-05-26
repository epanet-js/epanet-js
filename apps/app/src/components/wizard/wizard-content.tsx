import React from "react";
interface WizardContentProps {
  children: React.ReactNode;
  minHeight?: string;
}

export const WizardContent: React.FC<WizardContentProps> = ({
  children,
  minHeight = "300px",
}) => {
  return (
    <div
      className="flex flex-col grow px-4 overflow-hidden"
      style={{ minHeight }}
    >
      {children}
    </div>
  );
};

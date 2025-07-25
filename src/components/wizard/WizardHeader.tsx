import React from "react";
import { WizardStepIndicator, type Step } from "./WizardStepIndicator";

interface WizardHeaderProps {
  title: string;
  steps: Step[];
  currentStep: number;
}

export const WizardHeader: React.FC<WizardHeaderProps> = ({
  title,
  steps,
  currentStep,
}) => {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      </div>

      <WizardStepIndicator
        steps={steps.map((step) => ({ ...step, ariaLabel: step.ariaLabel }))}
        currentStep={currentStep}
      />
    </div>
  );
};

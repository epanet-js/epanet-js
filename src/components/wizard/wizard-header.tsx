import React from "react";
import { WizardStepIndicator, type Step } from "./wizard-step-indicator";
import { CloseIcon } from "src/icons";

interface WizardHeaderProps {
  title: string;
  steps: Step[];
  currentStep: number;
  onClose?: () => void;
  badge?: React.ReactNode;
}

export const WizardHeader: React.FC<WizardHeaderProps> = ({
  title,
  steps,
  currentStep,
  onClose,
  badge,
}) => {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {badge}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close wizard"
            className="text-gray-500 shrink-0 self-start
                      focus:bg-gray-200 dark:focus:bg-black
                      hover:text-black dark:hover:text-white"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <WizardStepIndicator
        steps={steps.map((step) => ({ ...step, ariaLabel: step.ariaLabel }))}
        currentStep={currentStep}
      />
    </div>
  );
};

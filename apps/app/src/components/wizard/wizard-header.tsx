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
      <div className="flex items-center justify-between mb-4 px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-default">{title}</h1>
          {badge}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close wizard"
            className="text-subtle shrink-0
                      focus:bg-base-hover
                      hover:text-default"
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

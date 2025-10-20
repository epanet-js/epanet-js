import React from "react";

export interface Step {
  number: number;
  label: string;
  ariaLabel: string;
}

interface WizardStepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export const WizardStepIndicator: React.FC<WizardStepIndicatorProps> = ({
  steps,
  currentStep,
}) => {
  return (
    <nav
      role="navigation"
      aria-label="Import wizard steps"
      className="flex items-center space-x-4 py-4"
    >
      {steps.map((step, index) => (
        <React.Fragment key={step.number}>
          <div className="flex items-center">
            <div
              role="tab"
              aria-label={step.ariaLabel}
              aria-current={currentStep === step.number ? "step" : undefined}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= step.number
                  ? "bg-purple-500 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {step.number}
            </div>
            <span
              className={`ml-2 text-sm hidden lg:inline ${
                currentStep >= step.number
                  ? "text-purple-600 font-medium"
                  : "text-gray-500"
              }`}
            >
              {step.label}
            </span>
          </div>

          {index < steps.length - 1 && (
            <div className="flex-1">
              <div
                className={`h-px ${
                  currentStep > step.number ? "bg-purple-500" : "bg-gray-300"
                }`}
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

import React from "react";
import { Cross1Icon } from "@radix-ui/react-icons";
import { WizardStepIndicator, type Step } from "./wizard-step-indicator";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { X } from "lucide-react";

interface WizardHeaderProps {
  title: string;
  steps: Step[];
  currentStep: number;
  onClose?: () => void;
}

export const WizardHeader: React.FC<WizardHeaderProps> = ({
  title,
  steps,
  currentStep,
  onClose,
}) => {
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close wizard"
            className="text-gray-500 shrink-0 self-start
                      focus:bg-gray-200 dark:focus:bg-black
                      hover:text-black dark:hover:text-white"
          >
            {isLucideIconsOn ? <X size={16} /> : <Cross1Icon />}
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

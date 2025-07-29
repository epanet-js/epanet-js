import React from "react";
import { Button } from "src/components/elements";

interface WizardAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "default" | "quiet";
  disabled?: boolean;
  loading?: boolean;
}

interface WizardActionsProps {
  cancelAction: WizardAction;
  backAction?: WizardAction;
  nextAction?: WizardAction;
  finishAction?: WizardAction;
}

export const WizardActions: React.FC<WizardActionsProps> = ({
  cancelAction,
  backAction,
  nextAction,
  finishAction,
}) => {
  return (
    <div
      role="navigation"
      aria-label="wizard actions"
      className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200"
    >
      <Button
        onClick={cancelAction.onClick}
        variant="default"
        size="sm"
        disabled={cancelAction.disabled}
      >
        {cancelAction.label}
      </Button>

      <div className="flex space-x-3">
        {backAction && (
          <Button
            onClick={backAction.onClick}
            variant="default"
            size="sm"
            disabled={backAction.disabled}
          >
            {backAction.label}
          </Button>
        )}

        {nextAction && (
          <Button
            onClick={nextAction.onClick}
            variant="primary"
            size="sm"
            disabled={nextAction.disabled}
          >
            {nextAction.label}
          </Button>
        )}

        {finishAction && (
          <Button
            onClick={finishAction.onClick}
            variant="primary"
            size="sm"
            disabled={finishAction.disabled}
          >
            {finishAction.loading ? finishAction.label : finishAction.label}
          </Button>
        )}
      </div>
    </div>
  );
};

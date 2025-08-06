import React from "react";
import { Button } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";

interface WizardAction {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string; // Optional override
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
  const translate = useTranslate();

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
        {cancelAction.label || translate("wizard.cancel")}
      </Button>

      <div className="flex space-x-3">
        {backAction && (
          <Button
            onClick={backAction.onClick}
            variant="default"
            size="sm"
            disabled={backAction.disabled}
          >
            {backAction.label || translate("wizard.back")}
          </Button>
        )}

        {nextAction && (
          <Button
            onClick={nextAction.onClick}
            variant="primary"
            size="sm"
            disabled={nextAction.disabled}
          >
            {nextAction.label || translate("wizard.next")}
          </Button>
        )}

        {finishAction && (
          <Button
            onClick={finishAction.onClick}
            variant="primary"
            size="sm"
            disabled={finishAction.disabled}
          >
            {finishAction.loading
              ? finishAction.label || translate("wizard.processing")
              : finishAction.label || translate("wizard.finish")}
          </Button>
        )}
      </div>
    </div>
  );
};

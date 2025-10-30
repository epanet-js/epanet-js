import React from "react";
import { Button } from "src/components/elements";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useTranslate } from "src/hooks/use-translate";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshIcon,
} from "src/icons";

interface WizardAction {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string; // Optional override
}

interface WizardActionsProps {
  backAction?: WizardAction;
  nextAction?: WizardAction;
  finishAction?: WizardAction;
}

export const WizardActions: React.FC<WizardActionsProps> = ({
  backAction,
  nextAction,
  finishAction,
}) => {
  const translate = useTranslate();
  const isModalLayoutEnabled = useFeatureFlag("FLAG_MODAL_LAYOUT");

  return (
    <div
      role="navigation"
      aria-label="wizard actions"
      className={
        isModalLayoutEnabled
          ? "flex justify-between items-center flex-shrink-0 pt-4 border-t border-gray-200"
          : "flex justify-between items-center mt-6 pt-4 border-t border-gray-200"
      }
    >
      <div className="flex space-x-3">
        {backAction && (
          <Button
            onClick={backAction.onClick}
            variant="quiet"
            size="sm"
            disabled={backAction.disabled}
          >
            <ChevronLeftIcon />
            {backAction.label || translate("wizard.back")}
          </Button>
        )}
      </div>

      <div className="flex space-x-3">
        {nextAction && (
          <Button
            onClick={nextAction.onClick}
            variant="primary"
            size="sm"
            disabled={nextAction.disabled}
          >
            {nextAction.label || translate("wizard.next")}
            <ChevronRightIcon />
          </Button>
        )}

        {finishAction && (
          <Button
            onClick={finishAction.onClick}
            variant="success"
            size="sm"
            disabled={finishAction.disabled}
          >
            {finishAction.loading ? (
              <RefreshIcon className="animate-spin" />
            ) : (
              <CheckIcon />
            )}
            {finishAction.loading
              ? finishAction.label || translate("wizard.processing")
              : finishAction.label || translate("wizard.finish")}
          </Button>
        )}
      </div>
    </div>
  );
};

import React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  UpdateIcon,
} from "@radix-ui/react-icons";
import { Button } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { Check, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

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
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

  return (
    <div
      role="navigation"
      aria-label="wizard actions"
      className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200"
    >
      <div className="flex space-x-3">
        {backAction && (
          <Button
            onClick={backAction.onClick}
            variant="quiet"
            size="sm"
            disabled={backAction.disabled}
          >
            {isLucideIconsOn ? (
              <ChevronLeft size={16} />
            ) : (
              <ChevronLeftIcon className="w-4 h-4" />
            )}
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
            {isLucideIconsOn ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronRightIcon className="w-4 h-4" />
            )}
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
              isLucideIconsOn ? (
                <RefreshCw size={16} className="w-4 h-4 animate-spin" />
              ) : (
                <UpdateIcon className="w-4 h-4 animate-spin" />
              )
            ) : isLucideIconsOn ? (
              <Check size={16} />
            ) : (
              <CheckIcon className="w-4 h-4" />
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

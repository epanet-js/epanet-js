import React from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { WizardState, WizardActions } from "./types";
import { WizardActions as WizardActionsComponent } from "src/components/wizard";

export const DemandOptionsStep: React.FC<{
  onNext: () => void;
  onBack: () => void;
  renderActions?: boolean;
  wizardState: WizardState & WizardActions;
}> = ({ onNext, onBack, renderActions = true, wizardState }) => {
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const { keepDemands, setKeepDemands, error } = wizardState;

  return (
    <>
      <div className="overflow-y-auto grow space-y-4">
        <h2 className="text-size-heading-3 font-semibold">
          {translate("importCustomerPoints.wizard.demandOptions.title")}
        </h2>

        {error && (
          <div className="bg-error-subtle border border-red-200 rounded-md p-3">
            <p className="text-red-700 text-size-base">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-3">
            <label
              className={`flex items-start space-x-3 cursor-pointer rounded-md p-3 border-2 transition-colors ${
                keepDemands
                  ? "border-accent bg-accent-tint"
                  : " bg-base hover:border-strong hover:bg-panel"
              }`}
            >
              <input
                type="radio"
                name="keepDemands"
                checked={keepDemands}
                onChange={() => {
                  setKeepDemands(true);
                  userTracking.capture({
                    name: "importCustomerPoints.demandOptions.selected",
                    option: "addOnTop",
                  });
                }}
                className="mt-1 h-4 w-4 text-accent-hover border-strong focus:ring-accent"
              />
              <div className="flex-1">
                <div className="font-medium text-default">
                  {translate(
                    "importCustomerPoints.wizard.demandOptions.addOnTopOption.title",
                  )}
                </div>
                <div className="text-size-base text-subtle mt-1">
                  {translate(
                    "importCustomerPoints.wizard.demandOptions.addOnTopOption.description",
                  )}
                </div>
              </div>
            </label>

            <label
              className={`flex items-start space-x-3 cursor-pointer rounded-md p-3 border-2 transition-colors ${
                !keepDemands
                  ? "border-accent bg-accent-tint"
                  : " bg-base hover:border-strong hover:bg-panel"
              }`}
            >
              <input
                type="radio"
                name="keepDemands"
                checked={!keepDemands}
                onChange={() => {
                  setKeepDemands(false);
                  userTracking.capture({
                    name: "importCustomerPoints.demandOptions.selected",
                    option: "replace",
                  });
                }}
                className="mt-1 h-4 w-4 text-accent-hover border-strong focus:ring-accent"
              />
              <div className="flex-1">
                <div className="font-medium text-default">
                  {translate(
                    "importCustomerPoints.wizard.demandOptions.deleteOption.title",
                  )}
                </div>
                <div className="text-size-base text-subtle mt-1">
                  {translate(
                    "importCustomerPoints.wizard.demandOptions.deleteOption.description",
                  )}
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      {renderActions && (
        <WizardActionsComponent
          backAction={{ onClick: onBack }}
          nextAction={{ onClick: onNext }}
        />
      )}
    </>
  );
};

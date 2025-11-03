import React from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { WizardState, WizardActions } from "./types";
import { WizardActions as WizardActionsComponent } from "src/components/wizard";

export const DemandOptionsStep: React.FC<{
  onNext: () => void;
  onBack: () => void;
  wizardState: WizardState & WizardActions;
}> = ({ onNext, onBack, wizardState }) => {
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const { keepDemands, setKeepDemands, error } = wizardState;

  return (
    <>
      <div className="overflow-y-auto flex-grow space-y-4">
        <h2 className="text-lg font-semibold">
          {translate("importCustomerPoints.wizard.demandOptions.title")}
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-3">
            <label
              className={`flex items-start space-x-3 cursor-pointer rounded-md p-3 border-2 transition-colors ${
                !keepDemands
                  ? "border-purple-500 bg-purple-50"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
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
                className="mt-1 h-4 w-4 text-purple-600 border-gray-300 focus:ring-purple-500"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  {translate(
                    "importCustomerPoints.wizard.demandOptions.replaceOption.title",
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {translate(
                    "importCustomerPoints.wizard.demandOptions.replaceOption.description",
                  )}
                </div>
              </div>
            </label>

            <label
              className={`flex items-start space-x-3 cursor-pointer rounded-md p-3 border-2 transition-colors ${
                keepDemands
                  ? "border-purple-500 bg-purple-50"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
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
                className="mt-1 h-4 w-4 text-purple-600 border-gray-300 focus:ring-purple-500"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  {translate(
                    "importCustomerPoints.wizard.demandOptions.addOnTopOption.title",
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {translate(
                    "importCustomerPoints.wizard.demandOptions.addOnTopOption.description",
                  )}
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      <WizardActionsComponent
        backAction={{
          onClick: onBack,
        }}
        nextAction={{
          onClick: onNext,
        }}
      />
    </>
  );
};

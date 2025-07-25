import React from "react";
import { WizardState, WizardActions } from "./types";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";

type DemandOptionsStepProps = {
  state: WizardState;
  actions: WizardActions;
  onFinish: () => Promise<void>;
};

export const DemandOptionsStep: React.FC<DemandOptionsStepProps> = ({
  state,
  actions,
  onFinish: _onFinish,
}) => {
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const customerPointCount = state.parsedCustomerPoints?.length || 0;
  const pointText =
    customerPointCount === 1
      ? translate("importCustomerPoints.wizard.demandOptions.customerPoint")
      : translate("importCustomerPoints.wizard.demandOptions.customerPoints");

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        {translate("importCustomerPoints.wizard.demandOptions.title")} (
        {customerPointCount} {pointText})
      </h2>

      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-700 text-sm">{state.error}</p>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">
          {translate(
            "importCustomerPoints.wizard.demandOptions.allocationOptions",
          )}
        </h3>
        <div className="space-y-3">
          <label
            className={`flex items-start space-x-3 cursor-pointer rounded-md p-3 border-2 transition-colors ${
              !state.keepDemands
                ? "border-purple-500 bg-purple-50"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name="keepDemands"
              checked={!state.keepDemands}
              onChange={() => {
                actions.setKeepDemands(false);
                userTracking.capture({
                  name: "importCustomerPoints.demandAllocationSelected",
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
              state.keepDemands
                ? "border-purple-500 bg-purple-50"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name="keepDemands"
              checked={state.keepDemands}
              onChange={() => {
                actions.setKeepDemands(true);
                userTracking.capture({
                  name: "importCustomerPoints.demandAllocationSelected",
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

      {state.isProcessing && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
          <span className="ml-2 text-sm text-gray-600">
            {translate(
              "importCustomerPoints.wizard.demandOptions.processingMessage",
            )}
          </span>
        </div>
      )}
    </div>
  );
};

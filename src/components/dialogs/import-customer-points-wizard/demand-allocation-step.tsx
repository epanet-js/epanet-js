import React from "react";
import { WizardState, WizardActions } from "./types";

type DemandAllocationStepProps = {
  state: WizardState;
  actions: WizardActions;
  onFinish: () => Promise<void>;
};

export const DemandAllocationStep: React.FC<DemandAllocationStepProps> = ({
  state,
  actions,
  onFinish: _onFinish,
}) => {
  const customerPointCount = state.parsedCustomerPoints?.length || 0;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Demand Allocation</h2>

      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-700 text-sm">{state.error}</p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h3 className="font-medium text-blue-900 mb-2">Import Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-blue-700">Selected file:</span>
            <span className="font-medium text-blue-900">
              {state.selectedFile?.name || "None"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">Customer points to import:</span>
            <span className="font-medium text-blue-900">
              {customerPointCount} points
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Demand Allocation Options</h3>
        <div className="space-y-3">
          <label
            className={`flex items-start space-x-3 cursor-pointer rounded-md p-3 border-2 transition-colors ${
              !state.keepDemands
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name="keepDemands"
              checked={!state.keepDemands}
              onChange={() => actions.setKeepDemands(false)}
              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">
                Replace existing demands with customer demands (default)
              </div>
              <div className="text-sm text-gray-600 mt-1">
                The existing base demands at junctions will be set to zero and
                replaced with the customer point demands. This is the typical
                approach for customer-based modeling.
              </div>
            </div>
          </label>

          <label
            className={`flex items-start space-x-3 cursor-pointer rounded-md p-3 border-2 transition-colors ${
              state.keepDemands
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <input
              type="radio"
              name="keepDemands"
              checked={state.keepDemands}
              onChange={() => actions.setKeepDemands(true)}
              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">
                Add customer demands on top of existing demands
              </div>
              <div className="text-sm text-gray-600 mt-1">
                The customer point demands will be added to the existing base
                demands at junctions. Use this option when you want to maintain
                the current network demands and add customer loads as additional
                demand.
              </div>
            </div>
          </label>
        </div>
      </div>

      {state.isProcessing && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-sm text-gray-600">
            Connecting customer points to network...
          </span>
        </div>
      )}
    </div>
  );
};

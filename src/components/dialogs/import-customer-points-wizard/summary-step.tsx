import React from "react";
import { WizardState, WizardActions } from "./types";

type SummaryStepProps = {
  state: WizardState;
  actions: WizardActions;
  onFinish: () => Promise<void>;
};

export const SummaryStep: React.FC<SummaryStepProps> = ({
  state,
  actions: _actions,
  onFinish: _onFinish,
}) => {
  const customerPointCount = state.parsedCustomerPoints?.length || 0;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Summary</h2>

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

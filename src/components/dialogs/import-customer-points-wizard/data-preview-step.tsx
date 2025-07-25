import React, { useState } from "react";
import { WizardState, WizardActions } from "./types";
import { useTranslate } from "src/hooks/use-translate";
import { CustomerPointsParserIssues } from "src/import/parse-customer-points-issues";

type DataPreviewStepProps = {
  state: WizardState;
  actions: WizardActions;
};

type TabType = "customerPoints" | "errors";

export const DataPreviewStep: React.FC<DataPreviewStepProps> = ({
  state,
  actions: _actions,
}) => {
  const translate = useTranslate();
  const [activeTab, setActiveTab] = useState<TabType>("customerPoints");

  if (!state.parsedDataSummary) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          {translate("importCustomerPoints.wizard.dataPreview.title")}
        </h2>
        <p className="text-gray-600">No data to preview</p>
      </div>
    );
  }

  const { validCustomerPoints, issues } = state.parsedDataSummary;
  const validCount = validCustomerPoints.length;
  const errorCount = getTotalErrorCount(issues);

  const MAX_PREVIEW_ROWS = 15;
  const validPreview = validCustomerPoints.slice(0, MAX_PREVIEW_ROWS);
  const validHasMore = validCount > MAX_PREVIEW_ROWS;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        {translate("importCustomerPoints.wizard.dataPreview.title")}
      </h2>

      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-700 text-sm">{state.error}</p>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "customerPoints"
                ? "bg-green-50 text-green-700 border-b-2 border-green-500"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => setActiveTab("customerPoints")}
          >
            {translate(
              "importCustomerPoints.wizard.dataPreview.customerPoints",
            )}{" "}
            ({validCount})
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "errors"
                ? "bg-red-50 text-red-700 border-b-2 border-red-500"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => setActiveTab("errors")}
          >
            {translate("importCustomerPoints.wizard.dataPreview.errors")} (
            {errorCount})
          </button>
        </div>

        <div className="h-80 overflow-y-auto">
          {activeTab === "customerPoints" && (
            <div className="p-4">
              {validCount === 0 ? (
                <p className="text-gray-500 text-sm">
                  No valid customer points found
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                          ID
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                          Coordinates
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                          Demand
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {validPreview.map((point, index) => (
                        <tr
                          key={point.id}
                          className={
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }
                        >
                          <td className="px-3 py-2 border-b">{point.id}</td>
                          <td className="px-3 py-2 border-b">
                            [{point.coordinates[0].toFixed(4)},{" "}
                            {point.coordinates[1].toFixed(4)}]
                          </td>
                          <td className="px-3 py-2 border-b">
                            {point.baseDemand}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {validHasMore && (
                    <p className="text-sm text-gray-500 text-center pt-2">
                      ... and {validCount - MAX_PREVIEW_ROWS} more customer
                      points
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "errors" && (
            <div className="p-4">
              {errorCount === 0 ? (
                <p className="text-gray-500 text-sm">No errors found</p>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-900">
                    Issues Summary
                  </h3>
                  <div className="space-y-2">
                    {issues?.skippedNonPointFeatures && (
                      <div className="flex items-start text-sm text-gray-600">
                        <span className="mr-2">•</span>
                        <span>
                          Non-point geometries ({issues.skippedNonPointFeatures}
                          )
                        </span>
                      </div>
                    )}
                    {issues?.skippedInvalidCoordinates && (
                      <div className="flex items-start text-sm text-gray-600">
                        <span className="mr-2">•</span>
                        <span>
                          Invalid coordinates (
                          {issues.skippedInvalidCoordinates})
                        </span>
                      </div>
                    )}
                    {issues?.skippedInvalidLines && (
                      <div className="flex items-start text-sm text-gray-600">
                        <span className="mr-2">•</span>
                        <span>
                          Invalid JSON lines ({issues.skippedInvalidLines})
                        </span>
                      </div>
                    )}
                    {issues?.skippedCreationFailures && (
                      <div className="flex items-start text-sm text-gray-600">
                        <span className="mr-2">•</span>
                        <span>
                          Creation failures ({issues.skippedCreationFailures})
                        </span>
                      </div>
                    )}
                    {issues?.skippedNoValidJunction && (
                      <div className="flex items-start text-sm text-gray-600">
                        <span className="mr-2">•</span>
                        <span>
                          No valid junction ({issues.skippedNoValidJunction})
                        </span>
                      </div>
                    )}
                    {issues?.connectionFailures && (
                      <div className="flex items-start text-sm text-gray-600">
                        <span className="mr-2">•</span>
                        <span>
                          Connection failures ({issues.connectionFailures})
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      These rows were skipped during import. Only valid customer
                      points will be processed.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const getTotalErrorCount = (
  issues: CustomerPointsParserIssues | null,
): number => {
  if (!issues) return 0;

  return (
    (issues.skippedNonPointFeatures || 0) +
    (issues.skippedInvalidCoordinates || 0) +
    (issues.skippedInvalidLines || 0) +
    (issues.skippedCreationFailures || 0) +
    (issues.skippedNoValidJunction || 0) +
    (issues.connectionFailures || 0)
  );
};

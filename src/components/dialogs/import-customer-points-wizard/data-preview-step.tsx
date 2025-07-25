import React, { useState } from "react";
import { WizardState, WizardActions } from "./types";
import { useTranslate } from "src/hooks/use-translate";
import { CustomerPointsParserIssues } from "src/import/parse-customer-points-issues";
import { localizeDecimal } from "src/infra/i18n/numbers";

type DataPreviewStepProps = {
  state: WizardState;
  actions: WizardActions;
};

type TabType = "customerPoints" | "issues";

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
        <p className="text-gray-600">
          {translate(
            "importCustomerPoints.wizard.dataPreview.messages.noValidCustomerPoints",
          )}
        </p>
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
            ({localizeDecimal(validCount, { decimals: 0 })})
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "issues"
                ? "bg-red-50 text-red-700 border-b-2 border-red-500"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => setActiveTab("issues")}
          >
            {translate("importCustomerPoints.wizard.dataPreview.issuesTab")} (
            {localizeDecimal(errorCount, { decimals: 0 })})
          </button>
        </div>

        <div className="h-80 overflow-y-auto">
          {activeTab === "customerPoints" && (
            <div className="p-4">
              {validCount === 0 ? (
                <p className="text-gray-500 text-sm">
                  {translate(
                    "importCustomerPoints.wizard.dataPreview.messages.noValidCustomerPoints",
                  )}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                          {translate(
                            "importCustomerPoints.wizard.dataPreview.table.id",
                          )}
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                          {translate(
                            "importCustomerPoints.wizard.dataPreview.table.latitude",
                          )}
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                          {translate(
                            "importCustomerPoints.wizard.dataPreview.table.longitude",
                          )}
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                          {translate(
                            "importCustomerPoints.wizard.dataPreview.table.demand",
                          )}
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
                            {localizeDecimal(point.coordinates[1], {
                              decimals: 6,
                            })}
                          </td>
                          <td className="px-3 py-2 border-b">
                            {localizeDecimal(point.coordinates[0], {
                              decimals: 6,
                            })}
                          </td>
                          <td className="px-3 py-2 border-b">
                            {localizeDecimal(point.baseDemand)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {validHasMore && (
                    <p className="text-sm text-gray-500 text-center pt-2">
                      {translate(
                        "importCustomerPoints.wizard.dataPreview.messages.andXMore",
                        localizeDecimal(validCount - MAX_PREVIEW_ROWS, {
                          decimals: 0,
                        }),
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "issues" && (
            <div className="p-4">
              {errorCount === 0 ? (
                <p className="text-gray-500 text-sm">
                  {translate(
                    "importCustomerPoints.wizard.dataPreview.messages.noErrors",
                  )}
                </p>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-900">
                    {translate(
                      "importCustomerPoints.wizard.dataPreview.messages.issuesSummary",
                    )}
                  </h3>
                  <div className="space-y-2">
                    {issues?.skippedNonPointFeatures && (
                      <div className="flex items-start text-sm text-gray-600">
                        <span className="mr-2">•</span>
                        <span>
                          {translate(
                            "importCustomerPoints.wizard.dataPreview.issues.nonPointGeometries",
                            issues.skippedNonPointFeatures.toString(),
                          )}
                        </span>
                      </div>
                    )}
                    {issues?.skippedInvalidCoordinates && (
                      <div className="flex items-start text-sm text-gray-600">
                        <span className="mr-2">•</span>
                        <span>
                          {translate(
                            "importCustomerPoints.wizard.dataPreview.issues.invalidCoordinates",
                            issues.skippedInvalidCoordinates.toString(),
                          )}
                        </span>
                      </div>
                    )}
                    {issues?.skippedInvalidLines && (
                      <div className="flex items-start text-sm text-gray-600">
                        <span className="mr-2">•</span>
                        <span>
                          {translate(
                            "importCustomerPoints.wizard.dataPreview.issues.invalidJsonLines",
                            issues.skippedInvalidLines.toString(),
                          )}
                        </span>
                      </div>
                    )}
                    {issues?.skippedCreationFailures && (
                      <div className="flex items-start text-sm text-gray-600">
                        <span className="mr-2">•</span>
                        <span>
                          {translate(
                            "importCustomerPoints.wizard.dataPreview.issues.creationFailures",
                            issues.skippedCreationFailures.toString(),
                          )}
                        </span>
                      </div>
                    )}
                    {issues?.skippedNoValidJunction && (
                      <div className="flex items-start text-sm text-gray-600">
                        <span className="mr-2">•</span>
                        <span>
                          {translate(
                            "importCustomerPoints.wizard.dataPreview.issues.noValidJunction",
                            issues.skippedNoValidJunction.toString(),
                          )}
                        </span>
                      </div>
                    )}
                    {issues?.connectionFailures && (
                      <div className="flex items-start text-sm text-gray-600">
                        <span className="mr-2">•</span>
                        <span>
                          {translate(
                            "importCustomerPoints.wizard.dataPreview.issues.connectionFailures",
                            issues.connectionFailures.toString(),
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      {translate(
                        "importCustomerPoints.wizard.dataPreview.messages.skippedRowsWarning",
                      )}
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

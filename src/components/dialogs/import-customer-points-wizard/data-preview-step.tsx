import React, { useState } from "react";
import { Feature } from "geojson";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { CustomerPointsParserIssues } from "src/import/parse-customer-points-issues";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { WizardState, WizardActions, ParsedDataSummary } from "./types";
import { WizardActions as WizardActionsComponent } from "src/components/wizard";
import { convertTo } from "src/quantity";

type TabType = "customerPoints" | "issues";

export const DataPreviewStep: React.FC<{
  onNext: () => void;
  onBack: () => void;
  onCancel: () => void;
  wizardState: WizardState & WizardActions;
}> = ({ onNext, onBack, onCancel, wizardState }) => {
  const translate = useTranslate();
  const [activeTab, setActiveTab] = useState<TabType>("customerPoints");
  const { parsedDataSummary, error } = wizardState;

  if (!parsedDataSummary) {
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

  const { validCustomerPoints, issues } = parsedDataSummary;
  const validCount = validCustomerPoints.length;
  const errorCount = getTotalErrorCount(issues);

  const MAX_PREVIEW_ROWS = 15;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        {translate("importCustomerPoints.wizard.dataPreview.title")}
      </h2>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-700 text-sm">{error}</p>
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
              errorCount === 0
                ? "text-gray-300 cursor-not-allowed"
                : activeTab === "issues"
                  ? "bg-red-50 text-red-700 border-b-2 border-red-500"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => errorCount > 0 && setActiveTab("issues")}
            disabled={errorCount === 0}
          >
            {translate("importCustomerPoints.wizard.dataPreview.issuesTab")} (
            {localizeDecimal(errorCount, { decimals: 0 })})
          </button>
        </div>

        <div className="h-80 overflow-y-auto">
          {activeTab === "customerPoints" && (
            <div className="p-4">
              <CustomerPointsTable
                customerPoints={validCustomerPoints}
                maxPreviewRows={MAX_PREVIEW_ROWS}
                parsedDataSummary={parsedDataSummary}
              />
            </div>
          )}

          {activeTab === "issues" && (
            <div className="p-4">
              <IssuesSummary issues={issues} />
            </div>
          )}
        </div>
      </div>

      <WizardActionsComponent
        cancelAction={{
          onClick: onCancel,
        }}
        backAction={{
          onClick: onBack,
        }}
        nextAction={
          parsedDataSummary
            ? {
                onClick: onNext,
              }
            : undefined
        }
      />
    </div>
  );
};

const getTotalErrorCount = (
  issues: CustomerPointsParserIssues | null,
): number => {
  if (!issues) return 0;

  return (
    (issues.skippedNonPointFeatures?.length || 0) +
    (issues.skippedInvalidCoordinates?.length || 0) +
    (issues.skippedCreationFailures?.length || 0)
  );
};

type CustomerPointsTableProps = {
  customerPoints: CustomerPoint[];
  maxPreviewRows: number;
  parsedDataSummary: ParsedDataSummary;
};

const CustomerPointsTable: React.FC<CustomerPointsTableProps> = ({
  customerPoints,
  maxPreviewRows,
  parsedDataSummary,
}) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const demandUnit = parsedDataSummary?.demandImportUnit || "l/d";
  const validCount = customerPoints.length;
  const validPreview = customerPoints.slice(0, maxPreviewRows);
  const validHasMore = validCount > maxPreviewRows;

  if (validCount === 0) {
    return (
      <p className="text-gray-500 text-sm">
        {translate(
          "importCustomerPoints.wizard.dataPreview.messages.noValidCustomerPoints",
        )}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wider border-b">
              {translate("importCustomerPoints.wizard.dataPreview.table.id")}
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wider border-b">
              {translate(
                "importCustomerPoints.wizard.dataPreview.table.latitude",
              )}
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500  tracking-wider border-b">
              {translate(
                "importCustomerPoints.wizard.dataPreview.table.longitude",
              )}
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wider border-b">
              {`${translate(
                "importCustomerPoints.wizard.dataPreview.table.demand",
              )} (${translateUnit(demandUnit)})`}
            </th>
          </tr>
        </thead>
        <tbody>
          {validPreview.map((point, index) => (
            <tr
              key={point.id}
              className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
            >
              <td className="px-3 py-2 border-b">{point.id}</td>
              <td className="px-3 py-2 border-b">
                {localizeDecimal(point.coordinates[1], { decimals: 6 })}
              </td>
              <td className="px-3 py-2 border-b">
                {localizeDecimal(point.coordinates[0], { decimals: 6 })}
              </td>
              <td className="px-3 py-2 border-b">
                {localizeDecimal(
                  convertTo(
                    { value: point.baseDemand, unit: "l/s" },
                    demandUnit,
                  ),
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {validHasMore && (
        <p className="text-sm text-gray-500 text-center pt-2">
          {translate(
            "importCustomerPoints.wizard.dataPreview.messages.andXMore",
            localizeDecimal(validCount - maxPreviewRows, { decimals: 0 }),
          )}
        </p>
      )}
    </div>
  );
};

type IssuesSummaryProps = {
  issues: CustomerPointsParserIssues | null;
};

const IssuesSummary: React.FC<IssuesSummaryProps> = ({ issues }) => {
  const translate = useTranslate();
  const errorCount = getTotalErrorCount(issues);

  if (errorCount === 0) {
    return (
      <p className="text-gray-500 text-sm">
        {translate("importCustomerPoints.wizard.dataPreview.messages.noErrors")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {issues?.skippedNonPointFeatures && (
          <IssueSection
            title={translate(
              "importCustomerPoints.wizard.dataPreview.issues.nonPointGeometries",
              issues.skippedNonPointFeatures.length.toString(),
            )}
            features={issues.skippedNonPointFeatures}
          />
        )}
        {issues?.skippedInvalidCoordinates && (
          <IssueSection
            title={translate(
              "importCustomerPoints.wizard.dataPreview.issues.invalidCoordinates",
              issues.skippedInvalidCoordinates.length.toString(),
            )}
            features={issues.skippedInvalidCoordinates}
          />
        )}
        {issues?.skippedCreationFailures && (
          <IssueSection
            title={translate(
              "importCustomerPoints.wizard.dataPreview.issues.creationFailures",
              issues.skippedCreationFailures.length.toString(),
            )}
            features={issues.skippedCreationFailures}
          />
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
  );
};

type IssueSectionProps = {
  title: string;
  features: Feature[];
};

const IssueSection: React.FC<IssueSectionProps> = ({ title, features }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const translate = useTranslate();

  return (
    <div className="border border-gray-200 rounded-md">
      <button
        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>{title}</span>
        <span className="text-xs text-gray-500">{isExpanded ? "−" : "+"}</span>
      </button>
      {isExpanded && (
        <div className="border-t border-gray-200 p-3 bg-gray-50">
          <div className="space-y-2">
            {features.slice(0, 3).map((feature, index) => (
              <div
                key={index}
                className="text-xs font-mono bg-white p-2 rounded border text-gray-800"
              >
                {JSON.stringify(feature)}
              </div>
            ))}
            {features.length > 3 && (
              <p className="text-xs text-gray-500 text-center pt-2">
                {translate(
                  "importCustomerPoints.wizard.dataPreview.messages.andXMoreIssues",
                  (features.length - 3).toString(),
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

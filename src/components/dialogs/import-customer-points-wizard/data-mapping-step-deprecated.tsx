import React, { useState, useEffect, useCallback } from "react";
import { Feature } from "geojson";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { useUserTracking } from "src/infra/user-tracking";
import { useAtomValue } from "jotai";
import { dataAtom } from "src/state/jotai";
import { parseCustomerPoints } from "src/import/parse-customer-points";
import {
  CustomerPointsIssuesAccumulator,
  CustomerPointsParserIssues,
} from "src/import/parse-customer-points-issues";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { localizeDecimal } from "src/infra/i18n/numbers";
import {
  WizardState,
  WizardActions,
  ParsedDataSummary,
  InputData,
} from "./types";
import { UnitsSpec } from "src/model-metadata/quantities-spec";
import { WizardActions as WizardActionsComponent } from "src/components/wizard";
import { convertTo } from "src/quantity";
import { ChevronDownIcon, ChevronRightIcon } from "src/icons";

type TabType = "customerPoints" | "issues";

export const DataMappingStepDeprecated: React.FC<{
  onNext: () => void;
  onBack: () => void;
  wizardState: WizardState & WizardActions & { units: UnitsSpec };
}> = ({ onNext, onBack, wizardState }) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const { modelMetadata } = useAtomValue(dataAtom);

  const {
    parsedDataSummary,
    error,
    inputData,
    selectedFile,
    selectedDemandProperty,
    setLoading,
    setError,
    setParsedDataSummary,
    isLoading,
  } = wizardState;

  const parseInputDataToCustomerPoints = useCallback(
    (inputData: InputData, demandPropertyName: string) => {
      setLoading(true);
      setError(null);

      try {
        const issues = new CustomerPointsIssuesAccumulator();
        const validCustomerPoints: CustomerPoint[] = [];
        let totalCount = 0;

        const demandImportUnit = modelMetadata.quantities.getUnit(
          "customerDemandPerDay",
        );
        const demandTargetUnit =
          modelMetadata.quantities.getUnit("customerDemand");

        const fileContent = JSON.stringify({
          type: "FeatureCollection",
          features: inputData.features,
        });

        for (const customerPoint of parseCustomerPoints(
          fileContent,
          issues,
          demandImportUnit,
          demandTargetUnit,
          1,
          demandPropertyName,
        )) {
          totalCount++;
          if (customerPoint) {
            validCustomerPoints.push(customerPoint);
          }
        }

        const parsedDataSummary: ParsedDataSummary = {
          validCustomerPoints,
          issues: issues.buildResult(),
          totalCount,
          demandImportUnit,
        };

        if (validCustomerPoints.length === 0) {
          userTracking.capture({
            name: "importCustomerPoints.dataMapping.noValidPoints",
            fileName: selectedFile!.name,
          });
        }

        setParsedDataSummary(parsedDataSummary);
        setLoading(false);

        userTracking.capture({
          name: "importCustomerPoints.dataMapping.customerPointsLoaded",
          validCount: validCustomerPoints.length,
          issuesCount: issues.count(),
          totalCount,
          fileName: selectedFile!.name,
        });
      } catch (error) {
        userTracking.capture({
          name: "importCustomerPoints.dataMapping.parseError",
          fileName: selectedFile!.name,
        });
        setError(translate("importCustomerPoints.dataSource.parseFileError"));
      }
    },
    [
      setLoading,
      setError,
      setParsedDataSummary,
      modelMetadata.quantities,
      userTracking,
      translate,
      selectedFile,
    ],
  );

  useEffect(() => {
    if (
      inputData &&
      !parsedDataSummary &&
      !isLoading &&
      selectedDemandProperty
    ) {
      parseInputDataToCustomerPoints(inputData, selectedDemandProperty);
    }
  }, [
    inputData,
    parsedDataSummary,
    isLoading,
    parseInputDataToCustomerPoints,
    selectedDemandProperty,
  ]);

  const hasValidPoints =
    (parsedDataSummary?.validCustomerPoints.length || 0) > 0;
  const [activeTab, setActiveTab] = useState<TabType>(
    hasValidPoints ? "customerPoints" : "issues",
  );

  if (!parsedDataSummary) {
    if (inputData && isLoading) {
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {translate("importCustomerPoints.wizard.dataMapping.title")}
          </h2>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">
              Parsing customer points...
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          {translate("importCustomerPoints.wizard.dataMapping.title")}
        </h2>
        <p className="text-gray-600">
          {translate(
            "importCustomerPoints.wizard.dataMapping.messages.noValidCustomerPoints",
          )}
        </p>
      </div>
    );
  }

  const { validCustomerPoints, issues } = parsedDataSummary;
  const validCount = validCustomerPoints.length;
  const errorCount = getTotalErrorCountDeprecated(issues);

  const MAX_PREVIEW_ROWS = 15;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        {translate("importCustomerPoints.wizard.dataMapping.title")}
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
              "importCustomerPoints.wizard.dataMapping.customerPoints",
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
            {translate("importCustomerPoints.wizard.dataMapping.issuesTab")} (
            {localizeDecimal(errorCount, { decimals: 0 })})
          </button>
        </div>

        <div className="h-80 overflow-y-auto">
          {activeTab === "customerPoints" && (
            <div className="p-4">
              <CustomerPointsTableDeprecated
                customerPoints={validCustomerPoints}
                maxPreviewRows={MAX_PREVIEW_ROWS}
                parsedDataSummary={parsedDataSummary}
                wizardState={wizardState}
              />
            </div>
          )}

          {activeTab === "issues" && (
            <div className="p-4">
              <IssuesSummaryDeprecated issues={issues} />
            </div>
          )}
        </div>
      </div>

      <WizardActionsComponent
        backAction={{
          onClick: onBack,
          disabled: isLoading,
        }}
        nextAction={{
          onClick: onNext,
          disabled: validCount === 0 || isLoading,
        }}
      />
    </div>
  );
};

const getTotalErrorCountDeprecated = (
  issues: CustomerPointsParserIssues | null,
): number => {
  if (!issues) return 0;

  return (
    (issues.skippedNonPointFeatures?.length || 0) +
    (issues.skippedInvalidCoordinates?.length || 0) +
    (issues.skippedMissingCoordinates?.length || 0) +
    (issues.skippedInvalidProjection?.length || 0) +
    (issues.skippedCreationFailures?.length || 0) +
    (issues.skippedInvalidDemands?.length || 0)
  );
};

type CustomerPointsTablePropsDeprecated = {
  customerPoints: CustomerPoint[];
  maxPreviewRows: number;
  parsedDataSummary: ParsedDataSummary;
  wizardState: WizardState & WizardActions & { units: UnitsSpec };
};

const CustomerPointsTableDeprecated: React.FC<
  CustomerPointsTablePropsDeprecated
> = ({ customerPoints, maxPreviewRows, parsedDataSummary: _, wizardState }) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const customerDemandUnit = wizardState.units.customerDemand;
  const customerDemandPerDayUnit = wizardState.units.customerDemandPerDay;
  const validCount = customerPoints.length;
  const validPreview = customerPoints.slice(0, maxPreviewRows);
  const validHasMore = validCount > maxPreviewRows;

  if (validCount === 0) {
    return (
      <p className="text-gray-500 text-sm">
        {translate(
          "importCustomerPoints.wizard.dataMapping.messages.noValidCustomerPoints",
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
              {translate("importCustomerPoints.wizard.dataMapping.table.id")}
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wider border-b">
              {translate(
                "importCustomerPoints.wizard.dataMapping.table.latitude",
              )}
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500  tracking-wider border-b">
              {translate(
                "importCustomerPoints.wizard.dataMapping.table.longitude",
              )}
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wider border-b">
              {`${translate(
                "importCustomerPoints.wizard.dataMapping.table.demand",
              )} (${translateUnit(customerDemandPerDayUnit)})`}
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
                    { value: point.baseDemand, unit: customerDemandUnit },
                    customerDemandPerDayUnit,
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
            "importCustomerPoints.wizard.dataMapping.messages.andXMore",
            localizeDecimal(validCount - maxPreviewRows, { decimals: 0 }),
          )}
        </p>
      )}
    </div>
  );
};

type IssuesSummaryPropsDeprecated = {
  issues: CustomerPointsParserIssues | null;
};

const IssuesSummaryDeprecated: React.FC<IssuesSummaryPropsDeprecated> = ({
  issues,
}) => {
  const translate = useTranslate();
  const errorCount = getTotalErrorCountDeprecated(issues);

  if (errorCount === 0) {
    return (
      <p className="text-gray-500 text-sm">
        {translate("importCustomerPoints.wizard.dataMapping.messages.noErrors")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            {translate(
              "importCustomerPoints.wizard.dataMapping.messages.skippedRowsWarning",
            )}
          </p>
        </div>
        {issues?.skippedNonPointFeatures && (
          <IssueSectionDeprecated
            title={translate(
              "importCustomerPoints.wizard.dataMapping.issues.nonPointGeometries",
              issues.skippedNonPointFeatures.length.toString(),
            )}
            features={issues.skippedNonPointFeatures}
          />
        )}
        {issues?.skippedInvalidCoordinates && (
          <IssueSectionDeprecated
            title={translate(
              "importCustomerPoints.wizard.dataMapping.issues.invalidCoordinates",
              issues.skippedInvalidCoordinates.length.toString(),
            )}
            features={issues.skippedInvalidCoordinates}
          />
        )}
        {issues?.skippedMissingCoordinates && (
          <IssueSectionDeprecated
            title={translate(
              "importCustomerPoints.wizard.dataMapping.issues.missingCoordinates",
              issues.skippedMissingCoordinates.length.toString(),
            )}
            features={issues.skippedMissingCoordinates}
          />
        )}
        {issues?.skippedInvalidProjection && (
          <IssueSectionDeprecated
            title={translate(
              "importCustomerPoints.wizard.dataMapping.issues.invalidProjection",
              issues.skippedInvalidProjection.length.toString(),
            )}
            features={issues.skippedInvalidProjection}
          />
        )}
        {issues?.skippedInvalidDemands && (
          <IssueSectionDeprecated
            title={translate(
              "importCustomerPoints.wizard.dataMapping.issues.invalidDemands",
              issues.skippedInvalidDemands.length.toString(),
            )}
            features={issues.skippedInvalidDemands}
          />
        )}
        {issues?.skippedCreationFailures && (
          <IssueSectionDeprecated
            title={translate(
              "importCustomerPoints.wizard.dataMapping.issues.creationFailures",
              issues.skippedCreationFailures.length.toString(),
            )}
            features={issues.skippedCreationFailures}
          />
        )}
      </div>
    </div>
  );
};

type IssueSectionPropsDeprecated = {
  title: string;
  features: Feature[];
};

const IssueSectionDeprecated: React.FC<IssueSectionPropsDeprecated> = ({
  title,
  features,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const translate = useTranslate();

  return (
    <div className="border border-gray-200 rounded-md">
      <button
        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>{title}</span>
        <span className="text-sm text-gray-500">
          {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </span>
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
                  "importCustomerPoints.wizard.dataMapping.messages.andXMoreIssues",
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

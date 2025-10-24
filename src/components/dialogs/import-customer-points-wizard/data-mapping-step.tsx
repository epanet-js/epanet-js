import React, { useState, useCallback } from "react";
import { Feature } from "geojson";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { useUserTracking } from "src/infra/user-tracking";
import { useAtomValue } from "jotai";
import { dataAtom } from "src/state/jotai";
import { parseCustomerPoints } from "src/import/customer-points/parse-customer-points";
import {
  CustomerPointsIssuesAccumulator,
  CustomerPointsParserIssues,
} from "src/import/customer-points/parse-customer-points-issues";
import {
  CustomerPoint,
  MAX_CUSTOMER_POINT_LABEL_LENGTH,
} from "src/hydraulic-model/customer-points";
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
import { Selector } from "src/components/form/selector";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

type TabType = "customerPoints" | "issues";

export const DataMappingStep: React.FC<{
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
    selectedLabelProperty,
    setLoading,
    setError,
    setParsedDataSummary,
    setSelectedDemandProperty,
    setSelectedLabelProperty,
    isLoading,
  } = wizardState;

  const parseInputDataToCustomerPoints = useCallback(
    (
      inputData: InputData,
      demandPropertyName: string,
      labelPropertyName: string | null = null,
    ) => {
      setLoading(true);
      setError(null);

      setTimeout(() => {
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
            labelPropertyName,
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
      }, 50);
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

  const handleDemandPropertyChange = useCallback(
    (property: string) => {
      userTracking.capture({
        name: "importCustomerPoints.dataMapping.selectDemand",
        property,
      });
      setSelectedDemandProperty(property);
      setParsedDataSummary(null);
      parseInputDataToCustomerPoints(
        inputData as InputData,
        property,
        selectedLabelProperty,
      );
    },
    [
      userTracking,
      setSelectedDemandProperty,
      setParsedDataSummary,
      parseInputDataToCustomerPoints,
      inputData,
      selectedLabelProperty,
    ],
  );

  const handleLabelPropertyChange = useCallback(
    (property: string) => {
      userTracking.capture({
        name: "importCustomerPoints.dataMapping.selectLabel",
        property,
      });
      setSelectedLabelProperty(property);
      if (selectedDemandProperty) {
        setParsedDataSummary(null);
        parseInputDataToCustomerPoints(
          inputData as InputData,
          selectedDemandProperty,
          property,
        );
      }
    },
    [
      userTracking,
      setSelectedLabelProperty,
      selectedDemandProperty,
      setParsedDataSummary,
      parseInputDataToCustomerPoints,
      inputData,
    ],
  );

  const [activeTab, setActiveTab] = useState<TabType>("customerPoints");

  const showAttributesMapping = !!inputData;
  const showLoading = inputData && isLoading && !parsedDataSummary;
  const showDataPreview = parsedDataSummary;
  const showNoDataMessage = !inputData;
  const validCount = parsedDataSummary?.validCustomerPoints.length || 0;
  const errorCount = getTotalErrorCount(parsedDataSummary?.issues || null);
  const MAX_PREVIEW_ROWS = 15;

  const isNextDisabled =
    isLoading ||
    !selectedDemandProperty ||
    (parsedDataSummary ? validCount === 0 : false);
  const isModalLayoutEnabled = useFeatureFlag("FLAG_MODAL_LAYOUT");

  return (
    <div
      className={
        isModalLayoutEnabled
          ? "overflow-y-auto flex flex-col gap-4 h-full"
          : "space-y-4"
      }
    >
      <h2 className="text-lg font-semibold">
        {translate("importCustomerPoints.wizard.dataMapping.title")}
      </h2>

      {showAttributesMapping && (
        <div className={isModalLayoutEnabled ? "space-y-4" : "space-y-8"}>
          <div>
            {isModalLayoutEnabled ? (
              ""
            ) : (
              <h3 className="text-md font-medium text-gray-900 mb-3">
                {translate(
                  "importCustomerPoints.wizard.dataMapping.attributesMapping.title",
                )}
              </h3>
            )}
            <p className="text-sm text-gray-600 mb-4">
              {translate(
                "importCustomerPoints.wizard.dataMapping.attributesMapping.description",
              )}
            </p>
            <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {translate(
                    "importCustomerPoints.wizard.dataMapping.demandSelector.label",
                  )}
                </label>
                <Selector
                  nullable={true}
                  placeholder={translate(
                    "importCustomerPoints.wizard.dataMapping.demandSelector.placeholder",
                  )}
                  options={Array.from(inputData.properties).map((prop) => ({
                    label: prop,
                    value: prop,
                  }))}
                  selected={selectedDemandProperty}
                  onChange={(value) => handleDemandPropertyChange(value || "")}
                  ariaLabel={translate(
                    "importCustomerPoints.wizard.dataMapping.demandSelector.label",
                  )}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {`${translate(
                    "importCustomerPoints.wizard.dataMapping.labelSelector.label",
                  )} (${translate("optional")})`}
                </label>
                <Selector
                  nullable={true}
                  placeholder={translate(
                    "importCustomerPoints.wizard.dataMapping.labelSelector.placeholder",
                  )}
                  options={[
                    {
                      label: translate(
                        "importCustomerPoints.wizard.dataMapping.labelSelector.noneAutoGenerate",
                      ),
                      value: "__NONE__",
                    },
                    ...Array.from(inputData.properties).map((prop) => ({
                      label: prop,
                      value: prop,
                    })),
                  ]}
                  selected={selectedLabelProperty || "__NONE__"}
                  onChange={(value) =>
                    handleLabelPropertyChange(
                      value === "__NONE__" ? "" : value || "",
                    )
                  }
                  ariaLabel={translate(
                    "importCustomerPoints.wizard.dataMapping.labelSelector.label",
                  )}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {translate(
                    "importCustomerPoints.wizard.dataMapping.labelSelector.description",
                    String(MAX_CUSTOMER_POINT_LABEL_LENGTH),
                  )}
                </p>
              </div>
            </div>
          </div>

          {showLoading && (
            <div>
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600">
                  {translate("importCustomerPoints.wizard.dataMapping.loading")}
                </span>
              </div>
            </div>
          )}

          {showDataPreview && (
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-2">
                {translate(
                  "importCustomerPoints.wizard.dataMapping.dataPreview.title",
                )}
              </h4>
            </div>
          )}

          {selectedDemandProperty && !parsedDataSummary && !showLoading && (
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-2">
                {translate(
                  "importCustomerPoints.wizard.dataMapping.dataPreview.title",
                )}
              </h4>
              <p className="text-sm text-gray-600">
                {translate(
                  "importCustomerPoints.wizard.dataMapping.dataPreview.selectPrompt",
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {showNoDataMessage && (
        <p className="text-gray-600">
          {translate(
            "importCustomerPoints.wizard.dataMapping.messages.noValidCustomerPoints",
          )}
        </p>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {showDataPreview && (
        <div
          className={
            isModalLayoutEnabled
              ? "border border-gray-200 rounded-lg"
              : "border border-gray-200 rounded-lg overflow-hidden"
          }
        >
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

          <div
            className={
              isModalLayoutEnabled ? "overflow-y-auto" : "h-80 overflow-y-auto"
            }
          >
            {activeTab === "customerPoints" && (
              <div className="p-4">
                <CustomerPointsTable
                  customerPoints={parsedDataSummary.validCustomerPoints}
                  maxPreviewRows={MAX_PREVIEW_ROWS}
                  parsedDataSummary={parsedDataSummary}
                  wizardState={wizardState}
                />
              </div>
            )}

            {activeTab === "issues" && (
              <div className="p-4">
                <IssuesSummary issues={parsedDataSummary.issues} />
              </div>
            )}
          </div>
        </div>
      )}

      <WizardActionsComponent
        backAction={{
          onClick: onBack,
          disabled: isLoading,
        }}
        nextAction={{
          onClick: onNext,
          disabled: isNextDisabled,
        }}
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
    (issues.skippedMissingCoordinates?.length || 0) +
    (issues.skippedInvalidProjection?.length || 0) +
    (issues.skippedCreationFailures?.length || 0) +
    (issues.skippedInvalidDemands?.length || 0)
  );
};

type CustomerPointsTableProps = {
  customerPoints: CustomerPoint[];
  maxPreviewRows: number;
  parsedDataSummary: ParsedDataSummary;
  wizardState: WizardState & WizardActions & { units: UnitsSpec };
};

const CustomerPointsTable: React.FC<CustomerPointsTableProps> = ({
  customerPoints,
  maxPreviewRows,
  parsedDataSummary: _,
  wizardState,
}) => {
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
              {translate("importCustomerPoints.wizard.dataMapping.table.label")}
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
              <td className="px-3 py-2 border-b">
                <div className="truncate" title={point.label}>
                  {point.label}
                </div>
              </td>
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

type IssuesSummaryProps = {
  issues: CustomerPointsParserIssues | null;
};

const IssuesSummary: React.FC<IssuesSummaryProps> = ({ issues }) => {
  const translate = useTranslate();
  const errorCount = getTotalErrorCount(issues);

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
          <IssueSection
            title={translate(
              "importCustomerPoints.wizard.dataMapping.issues.nonPointGeometries",
              issues.skippedNonPointFeatures.length.toString(),
            )}
            features={issues.skippedNonPointFeatures}
          />
        )}
        {issues?.skippedInvalidCoordinates && (
          <IssueSection
            title={translate(
              "importCustomerPoints.wizard.dataMapping.issues.invalidCoordinates",
              issues.skippedInvalidCoordinates.length.toString(),
            )}
            features={issues.skippedInvalidCoordinates}
          />
        )}
        {issues?.skippedMissingCoordinates && (
          <IssueSection
            title={translate(
              "importCustomerPoints.wizard.dataMapping.issues.missingCoordinates",
              issues.skippedMissingCoordinates.length.toString(),
            )}
            features={issues.skippedMissingCoordinates}
          />
        )}
        {issues?.skippedInvalidProjection && (
          <IssueSection
            title={translate(
              "importCustomerPoints.wizard.dataMapping.issues.invalidProjection",
              issues.skippedInvalidProjection.length.toString(),
            )}
            features={issues.skippedInvalidProjection}
          />
        )}
        {issues?.skippedInvalidDemands && (
          <IssueSection
            title={translate(
              "importCustomerPoints.wizard.dataMapping.issues.invalidDemands",
              issues.skippedInvalidDemands.length.toString(),
            )}
            features={issues.skippedInvalidDemands}
          />
        )}
        {issues?.skippedCreationFailures && (
          <IssueSection
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

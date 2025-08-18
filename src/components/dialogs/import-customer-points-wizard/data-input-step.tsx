import React, { useCallback } from "react";
import { parseCustomerPoints } from "src/import/parse-customer-points";
import { CustomerPointsIssuesAccumulator } from "src/import/parse-customer-points-issues";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { ParsedDataSummary, WizardState, WizardActions } from "./types";
import { useUserTracking } from "src/infra/user-tracking";
import { captureError } from "src/infra/error-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { DropZone } from "src/components/drop-zone";
import { WizardActions as WizardActionsComponent } from "src/components/wizard";
import { useAtomValue } from "jotai";
import { dataAtom } from "src/state/jotai";

export const DataInputStep: React.FC<{
  onNext: () => void;
  wizardState: WizardState & WizardActions;
}> = ({ onNext, wizardState }) => {
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const { modelMetadata } = useAtomValue(dataAtom);

  const {
    selectedFile,
    error,
    isLoading,
    setSelectedFile,
    setLoading,
    setError,
    setParsedDataSummary,
    parsedDataSummary,
  } = wizardState;

  const handleFileProcess = useCallback(
    async (file: File) => {
      setSelectedFile(file);
      setLoading(true);
      setError(null);

      try {
        const text = await file.text();
        const issues = new CustomerPointsIssuesAccumulator();
        const validCustomerPoints: CustomerPoint[] = [];
        let totalCount = 0;

        const demandImportUnit = modelMetadata.quantities.getUnit(
          "customerDemandPerDay",
        );
        const demandTargetUnit =
          modelMetadata.quantities.getUnit("customerDemand");

        for (const customerPoint of parseCustomerPoints(
          text,
          issues,
          demandImportUnit,
          demandTargetUnit,
          1,
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
            name: "importCustomerPoints.dataInput.noValidPoints",
            fileName: file.name,
          });
          setError(
            translate("importCustomerPoints.dataSource.noValidPointsError"),
          );
          return;
        }

        setParsedDataSummary(parsedDataSummary);
        setLoading(false);

        userTracking.capture({
          name: "importCustomerPoints.dataInput.customerPointsLoaded",
          validCount: validCustomerPoints.length,
          totalCount,
          fileName: file.name,
        });

        onNext();
      } catch (error) {
        userTracking.capture({
          name: "importCustomerPoints.dataInput.parseError",
          fileName: file.name,
        });
        captureError(error as Error);
        setError(translate("importCustomerPoints.dataSource.parseFileError"));
      }
    },
    [
      setSelectedFile,
      setLoading,
      setError,
      setParsedDataSummary,
      onNext,
      userTracking,
      translate,
      modelMetadata.quantities,
    ],
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        {translate("importCustomerPoints.dataSource.title")}
      </h2>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <DropZone
          onFileDrop={handleFileProcess}
          accept=".geojson,.geojsonl"
          disabled={isLoading}
          supportedFormats="GeoJSON (.geojson), GeoJSONL (.geojsonl)"
          selectedFile={selectedFile}
          testId="customer-points-drop-zone"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-sm text-gray-600">
            {translate("importCustomerPoints.dataSource.parsingFile")}
          </span>
        </div>
      )}

      <WizardActionsComponent
        nextAction={{
          onClick: onNext,
          disabled: !parsedDataSummary,
        }}
      />
    </div>
  );
};

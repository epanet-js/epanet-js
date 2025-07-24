import React, { useCallback } from "react";
import { parseCustomerPoints } from "src/import/parse-customer-points";
import { CustomerPointsIssuesAccumulator } from "src/import/parse-customer-points-issues";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { WizardState, WizardActions } from "./types";
import { useUserTracking } from "src/infra/user-tracking";
import { captureError } from "src/infra/error-tracking";
import { useTranslate } from "src/hooks/use-translate";

type DataSourceStepProps = {
  state: WizardState;
  actions: WizardActions;
};

export const DataSourceStep: React.FC<DataSourceStepProps> = ({
  state,
  actions,
}) => {
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      actions.setSelectedFile(file);
      actions.setLoading(true);

      try {
        const text = await file.text();
        const issues = new CustomerPointsIssuesAccumulator();
        const parsedPoints: CustomerPoint[] = [];

        for (const customerPoint of parseCustomerPoints(text, issues, 1)) {
          parsedPoints.push(customerPoint);
        }

        if (parsedPoints.length === 0) {
          userTracking.capture({
            name: "importCustomerPoints.noValidPoints",
          });
          actions.setError(
            translate("importCustomerPoints.dataSource.noValidPointsError"),
          );
          return;
        }

        actions.setParsedCustomerPoints(parsedPoints);
        actions.setLoading(false);

        actions.goNext();
      } catch (error) {
        userTracking.capture({
          name: "importCustomerPoints.parseError",
        });
        captureError(error as Error);
        actions.setError(
          translate("importCustomerPoints.dataSource.parseFileError"),
        );
      }
    },
    [actions, userTracking, translate],
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        {translate("importCustomerPoints.dataSource.title")}
      </h2>

      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-700 text-sm">{state.error}</p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <input
            type="file"
            accept=".geojson,.geojsonl"
            onChange={handleFileSelect}
            disabled={state.isLoading}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-1">
            {translate("importCustomerPoints.dataSource.supportedFormats")}{" "}
            GeoJSON (.geojson), GeoJSONL (.geojsonl)
          </p>
        </div>
      </div>

      {state.isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-sm text-gray-600">
            {translate("importCustomerPoints.dataSource.parsingFile")}
          </span>
        </div>
      )}
    </div>
  );
};

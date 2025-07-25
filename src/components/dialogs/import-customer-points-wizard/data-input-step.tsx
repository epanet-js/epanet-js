import React, { useCallback, useRef } from "react";
import { parseCustomerPoints } from "src/import/parse-customer-points";
import { CustomerPointsIssuesAccumulator } from "src/import/parse-customer-points-issues";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { WizardState, WizardActions } from "./types";
import { useUserTracking } from "src/infra/user-tracking";
import { captureError } from "src/infra/error-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useDropZone } from "src/hooks/use-drop-zone";
import { UploadIcon } from "@radix-ui/react-icons";

type DataInputStepProps = {
  state: WizardState;
  actions: WizardActions;
};

export const DataInputStep: React.FC<DataInputStepProps> = ({
  state,
  actions,
}) => {
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileProcess = useCallback(
    async (file: File) => {
      actions.setSelectedFile(file);
      actions.setLoading(true);
      actions.setError(null);

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

  const { dragState, dropZoneProps, inputProps } = useDropZone({
    onFileDrop: handleFileProcess,
    accept: ".geojson,.geojsonl",
    disabled: state.isLoading,
  });

  const handleDropZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

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

      <div className="space-y-4">
        <div
          {...dropZoneProps}
          onClick={handleDropZoneClick}
          className={`
            relative min-h-[200px] border-2 border-dashed rounded-lg
            flex flex-col items-center justify-center p-8 cursor-pointer
            transition-all duration-200 ease-in-out
            ${dragState === "idle" ? "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100" : ""}
            ${dragState === "dragging" ? "border-blue-400 bg-blue-50" : ""}
            ${dragState === "over" ? "border-blue-500 border-solid bg-blue-100" : ""}
            ${state.isLoading ? "opacity-50 cursor-not-allowed" : ""}
          `}
          data-testid="customer-points-drop-zone"
        >
          <input ref={fileInputRef} {...inputProps} id="file-input" />

          <div className="flex flex-col items-center space-y-4">
            <div
              className={`
              p-3 rounded-full
              ${dragState === "over" ? "bg-blue-200" : "bg-gray-200"}
            `}
            >
              <UploadIcon
                className={`h-8 w-8 ${
                  dragState === "over" ? "text-blue-600" : "text-gray-400"
                }`}
              />
            </div>

            <div className="text-center">
              <p
                className={`text-lg font-medium ${
                  dragState === "over" ? "text-blue-700" : "text-gray-700"
                }`}
              >
                {dragState === "over"
                  ? "Drop your file here"
                  : "Drop files here or click to browse"}
              </p>

              <p className="text-sm text-gray-500 mt-2">
                {translate("importCustomerPoints.dataSource.supportedFormats")}{" "}
                GeoJSON (.geojson), GeoJSONL (.geojsonl)
              </p>
            </div>
          </div>

          {state.selectedFile && (
            <div className="absolute bottom-4 left-4 right-4">
              <div className="bg-white rounded-md px-3 py-2 border border-gray-200 shadow-sm">
                <p className="text-sm text-gray-600 truncate">
                  Selected: {state.selectedFile.name}
                </p>
              </div>
            </div>
          )}
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

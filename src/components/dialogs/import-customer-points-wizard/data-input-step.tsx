import React, { useCallback } from "react";
import { WizardState, WizardActions } from "./types";
import { useUserTracking } from "src/infra/user-tracking";
import { captureError } from "src/infra/error-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { DropZone } from "src/components/drop-zone";
import { WizardActions as WizardActionsComponent } from "src/components/wizard";
import { parseGeoJson } from "src/lib/geojson-utils/parse-geojson";
import type { Projection } from "src/hooks/use-projections";
import {
  customerPointsImportGuide,
  customerPointsImportVideoUrl,
} from "src/global-config";
import { Trans } from "react-i18next";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const DataInputStep: React.FC<{
  onNext: () => void;
  wizardState: WizardState & WizardActions;
  projections?: Map<string, Projection> | null;
}> = ({ onNext, wizardState, projections }) => {
  const userTracking = useUserTracking();
  const translate = useTranslate();

  const {
    selectedFile,
    error,
    isLoading,
    setSelectedFile,
    setLoading,
    setError,
    setInputData,
    resetWizardData,
    inputData,
  } = wizardState;

  const handleFileRejected = useCallback(
    (file: File, _reason: string) => {
      userTracking.capture({
        name: "importCustomerPoints.dataInput.unsupportedFormat",
        fileName: file.name,
      });
      setError(
        translate("importCustomerPoints.dataSource.fileFormatNotSupported"),
      );
      setLoading(false);
    },
    [userTracking, setError, translate, setLoading],
  );

  const handleFileProcess = useCallback(
    async (file: File) => {
      resetWizardData();
      setSelectedFile(file);
      setLoading(true);

      try {
        const text = await file.text();

        try {
          const {
            features,
            properties,
            error: validationError,
            coordinateConversion,
            hasValidGeometry,
          } = parseGeoJson(text, projections || undefined);

          if (validationError) {
            let errorMessage: string;

            if (validationError.code === "unsupported-crs") {
              errorMessage = translate(
                "importCustomerPoints.dataSource.unsupportedCrsError",
              );
            } else if (
              validationError.code === "projection-conversion-failed"
            ) {
              errorMessage = translate(
                "importCustomerPoints.dataSource.projectionConversionError",
              );
            } else {
              errorMessage = translate(
                "importCustomerPoints.dataSource.coordinateValidationError",
              );
            }

            userTracking.capture({
              name: "importCustomerPoints.dataInput.parseError",
              fileName: file.name,
              errorCode: validationError.code,
            });
            setError(errorMessage);
            setLoading(false);
            return;
          }

          if (hasValidGeometry === false) {
            userTracking.capture({
              name: "importCustomerPoints.dataInput.noValidPoints",
              fileName: file.name,
            });
            setError(
              translate("importCustomerPoints.dataSource.noValidPointsError"),
            );
            setLoading(false);
            return;
          }

          if (features.length === 0) {
            userTracking.capture({
              name: "importCustomerPoints.dataInput.noValidPoints",
              fileName: file.name,
            });
            setError(
              translate("importCustomerPoints.dataSource.noValidPointsError"),
            );
            setLoading(false);
            return;
          }

          setInputData({ features, properties });
          setLoading(false);

          userTracking.capture({
            name: "importCustomerPoints.dataInput.fileLoaded",
            fileName: file.name,
            propertiesCount: properties.size,
            featuresCount: features.length,
            coordinateConversion: coordinateConversion
              ? {
                  detected: coordinateConversion.detected,
                  converted: coordinateConversion.converted,
                  fromCRS: coordinateConversion.fromCRS,
                }
              : null,
          });

          onNext();
        } catch (error) {
          userTracking.capture({
            name: "importCustomerPoints.dataInput.parseError",
            fileName: file.name,
          });
          captureError(error as Error);
          setError(translate("importCustomerPoints.dataSource.parseFileError"));
          setLoading(false);
          return;
        }
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
      resetWizardData,
      setSelectedFile,
      setLoading,
      setError,
      setInputData,
      onNext,
      userTracking,
      translate,
      projections,
    ],
  );
  const isModalLayoutEnabled = useFeatureFlag("FLAG_MODAL_LAYOUT");

  return (
    <>
      <div
        className={
          isModalLayoutEnabled
            ? "grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto flex-grow"
            : "grid grid-cols-1 md:grid-cols-2 gap-6"
        }
      >
        {/* Left Column - File Input */}
        <div
          className={
            isModalLayoutEnabled
              ? "bg-white dark:bg-slate-800 space-y-6 h-full md:p-6 p-2"
              : "bg-white dark:bg-slate-800 p-6 space-y-6 h-full"
          }
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
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
              onFileRejected={handleFileRejected}
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
        </div>

        {/* Right Column - Video Tutorial */}
        <div
          className={
            isModalLayoutEnabled
              ? "bg-white dark:bg-slate-800 h-full space-y-6 md:p-6 p-2"
              : "bg-white dark:bg-slate-800 p-6 h-full space-y-6"
          }
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {translate("importCustomerPoints.wizard.videoTutorial.title")}
          </h2>
          <div
            style={{ height: 216 }}
            className="relative overflow-hidden rounded-lg shadow-lg cursor-pointer"
            onClick={() =>
              window.open(
                customerPointsImportVideoUrl,
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            <img
              src="/images/customer-import-thumbnail.png"
              alt={translate(
                "importCustomerPoints.wizard.videoTutorial.altText",
              )}
              className="w-full h-full object-cover transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                {/* Outer glow effect */}
                <div className="absolute inset-0 bg-white/20 rounded-full blur-md group-hover:blur-lg transition-all duration-300"></div>

                {/* Main play button */}
                <span className="relative inline-flex items-center justify-center rounded-full bg-black/60 group-hover:bg-black/80 text-white h-16 w-16 group-hover:scale-110 transition-all duration-300 shadow-lg">
                  <svg
                    className="h-7 w-7 ml-1"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </div>

              {/* Video duration indicator */}
              <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
                5:23
              </div>

              {/* Video title overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <p className="text-white text-sm font-medium">
                  epanet-js Customer Points Import Tutorial
                </p>
              </div>
            </div>
          </div>

          <p className="text-slate-700 dark:text-slate-300 text-sm">
            <Trans
              i18nKey="importCustomerPoints.wizard.videoTutorial.description"
              components={{
                guideLink: (
                  <a
                    href={customerPointsImportGuide}
                    target="_blank"
                    className="text-purple-700 dark:text-purple-300 underline"
                  />
                ),
              }}
            />
          </p>
        </div>
      </div>

      <WizardActionsComponent
        nextAction={{
          onClick: onNext,
          disabled: !inputData,
        }}
      />
    </>
  );
};

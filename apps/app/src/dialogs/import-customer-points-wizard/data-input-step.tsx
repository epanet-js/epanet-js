import React, { useCallback, useState } from "react";
import { WizardState, WizardActions } from "./types";
import { useUserTracking } from "src/infra/user-tracking";
import { captureError } from "src/infra/error-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { GisDropZone, type GisFiles } from "src/components/gis-drop-zone";
import { parseGeoJson } from "src/lib/geojson-utils/parse-geojson";
import { parseShapefile } from "src/lib/gis-import/parse-shapefile";
import { GisParseError } from "src/lib/gis-import/types";
import type { Proj4Projection } from "src/lib/projections";
import {
  customerPointsImportGuide,
  customerPointsImportVideoUrl,
} from "src/global-config";
import { Trans } from "react-i18next";
import { WizardActions as WizardActionsComponent } from "src/components/wizard";

export const DataInputStep: React.FC<{
  onNext: () => void;
  renderActions?: boolean;
  wizardState: WizardState & WizardActions;
  projections?: Map<string, Proj4Projection> | null;
}> = ({ onNext, renderActions = true, wizardState, projections }) => {
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const [gisFiles, setGisFiles] = useState<GisFiles>({});

  const {
    error,
    isLoading,
    setSelectedFile,
    setLoading,
    setError,
    setInputData,
    resetWizardData,
    inputData,
  } = wizardState;

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

  const handleShapefileProcess = useCallback(
    async (files: GisFiles) => {
      const shpFile = files.shp;
      if (!shpFile) return;

      resetWizardData();
      setSelectedFile(shpFile);
      setLoading(true);

      try {
        const fileArray = [files.shp, files.dbf, files.prj, files.cpg].filter(
          (f): f is File => f != null,
        );
        const result = await parseShapefile(fileArray);
        const features = result.featureCollection.features;

        if (features.length === 0) {
          userTracking.capture({
            name: "importCustomerPoints.dataInput.noValidPoints",
            fileName: shpFile.name,
          });
          setError(
            translate("importCustomerPoints.dataSource.noValidPointsError"),
          );
          setLoading(false);
          return;
        }

        setInputData({
          features,
          properties: new Set(result.properties),
        });
        setLoading(false);

        userTracking.capture({
          name: "importCustomerPoints.dataInput.fileLoaded",
          fileName: shpFile.name,
          propertiesCount: result.properties.length,
          featuresCount: features.length,
          coordinateConversion: result.coordinateConversion ?? null,
        });

        onNext();
      } catch (err) {
        const fileName = shpFile.name;
        userTracking.capture({
          name: "importCustomerPoints.dataInput.parseError",
          fileName,
          errorCode: err instanceof GisParseError ? err.code : undefined,
        });

        if (err instanceof GisParseError) {
          if (
            err.code === "unsupported-crs" ||
            err.code === "projection-conversion-failed"
          ) {
            setError(
              translate("importCustomerPoints.dataSource.unsupportedCrsError"),
            );
          } else if (
            err.code === "missing-projection" ||
            err.code === "invalid-projection"
          ) {
            setError(
              translate(
                "importCustomerPoints.dataSource.coordinateValidationError",
              ),
            );
          } else {
            setError(
              translate("importCustomerPoints.dataSource.parseFileError"),
            );
          }
        } else {
          captureError(err as Error);
          setError(translate("importCustomerPoints.dataSource.parseFileError"));
        }
        setLoading(false);
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
    ],
  );

  const handleGisFilesDrop = useCallback(
    (files: GisFiles) => {
      setGisFiles(files);

      if (files.geojson || files.geojsonl) {
        const file = (files.geojson ?? files.geojsonl)!;
        void handleFileProcess(file);
      } else if (files.shp && files.dbf && files.prj) {
        void handleShapefileProcess(files);
      }
    },
    [handleFileProcess, handleShapefileProcess],
  );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto grow">
        {/* Left Column - File Input */}
        <div className="bg-base dark:bg-slate-800 space-y-6 h-full md:p-6 p-2">
          <h2 className="text-size-heading-3 font-semibold text-slate-900 dark:text-white">
            {translate("importCustomerPoints.dataSource.title")}
          </h2>

          {error && (
            <div className="bg-error-subtle border border-red-200 rounded-md p-3">
              <p className="text-red-700 text-size-base">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <GisDropZone
              onFileDrop={handleGisFilesDrop}
              supportedFormats={["geojson", "geojsonl", "shapefile"]}
              selectedFiles={gisFiles}
              disabled={isLoading}
              testId="customer-points-drop-zone"
            />
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-size-base text-subtle">
                {translate("importCustomerPoints.dataSource.parsingFile")}
              </span>
            </div>
          )}
        </div>

        {/* Right Column - Video Tutorial */}
        <div className="bg-base dark:bg-slate-800 h-full space-y-6 md:p-6 p-2">
          <h2 className="text-size-heading-3 font-semibold text-slate-900 dark:text-white">
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
            <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent"></div>

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                {/* Outer glow effect */}
                <div className="absolute inset-0 bg-base/20 rounded-full blur-md group-hover:blur-lg transition-all duration-300"></div>

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
              <div className="absolute bottom-3 right-3 bg-black/70 text-white text-size-small px-2 py-1 rounded-sm">
                5:23
              </div>

              {/* Video title overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-4">
                <p className="text-white text-size-base font-medium">
                  epanet-js Customer Points Import Tutorial
                </p>
              </div>
            </div>
          </div>

          <p className="text-slate-700 dark:text-slate-300 text-size-base">
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

      {renderActions && (
        <WizardActionsComponent
          nextAction={{
            onClick: onNext,
            disabled: !inputData,
          }}
        />
      )}
    </>
  );
};

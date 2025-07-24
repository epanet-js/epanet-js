import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { captureError } from "src/infra/error-tracking";
import { useUserTracking } from "src/infra/user-tracking";
import { parseCustomerPoints } from "src/import/parse-customer-points";
import { connectCustomerPoint } from "src/hydraulic-model/mutations/connect-customer-point";
import { initializeCustomerPoints } from "src/hydraulic-model/customer-points";
import { dataAtom, dialogAtom } from "src/state/jotai";
import {
  CustomerPointsParserIssues,
  CustomerPointsIssuesAccumulator,
} from "src/import/parse-customer-points-issues";
import { UserEvent } from "src/infra/user-tracking";
import { CustomerPointsImportSummaryState } from "src/state/dialog";
import { createSpatialIndex } from "src/hydraulic-model/spatial-index";
import { getAssetsByType } from "src/__helpers__/asset-queries";
import { Pipe } from "src/hydraulic-model/asset-types/pipe";
import { useFileOpen } from "src/hooks/use-file-open";

const geoJsonExtension = ".geojson";
const geoJsonLExtension = ".geojsonl";

export const useImportCustomerPointsLegacy = () => {
  const data = useAtomValue(dataAtom);
  const setData = useSetAtom(dataAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const { openFile, isReady } = useFileOpen();

  const importCustomerPoints = useCallback(
    async ({ source }: { source: string }) => {
      userTracking.capture({
        name: "importCustomerPoints.started",
        source,
      });

      try {
        if (!isReady) throw new Error("FS not ready");

        const file = await openFile({
          multiple: false,
          extensions: [geoJsonExtension, geoJsonLExtension],
          description: "GeoJSON/GeoJSONL Customer Points",
        });

        if (!file) {
          userTracking.capture({
            name: "importCustomerPoints.canceled",
          });
          return;
        }

        setDialogState({ type: "loading" });

        const text = await file.text();

        const nextId = 1;

        const pipes = getAssetsByType<Pipe>(data.hydraulicModel.assets, "pipe");
        const spatialIndexData = createSpatialIndex(pipes);

        const issues = new CustomerPointsIssuesAccumulator();
        const mutableHydraulicModel = {
          ...data.hydraulicModel,
          customerPoints: initializeCustomerPoints(),
        };

        for (const customerPoint of parseCustomerPoints(text, issues, nextId)) {
          const connection = connectCustomerPoint(
            mutableHydraulicModel,
            spatialIndexData,
            customerPoint,
          );

          if (!connection) {
            issues.addSkippedNoValidJunction();
          }
        }

        const finalIssues = issues.buildResult();

        setData({
          ...data,
          hydraulicModel: mutableHydraulicModel,
        });

        const { dialogState, trackingEvent } = processImportResult(
          mutableHydraulicModel.customerPoints.size,
          finalIssues,
        );

        setDialogState(dialogState);
        userTracking.capture(trackingEvent);
      } catch (error) {
        setDialogState({
          type: "unexpectedError",
          onRetry: () =>
            importCustomerPoints({ source: "unexpected-error-dialog" }),
        });
        captureError(error as Error);
        userTracking.capture({
          name: "importCustomerPoints.unexpectedError",
          error: (error as Error).message,
        });
      }
    },
    [openFile, isReady, data, setData, setDialogState, userTracking],
  );

  return importCustomerPoints;
};

type ImportStatus = "success" | "warning" | "error";

type ProcessImportResult = {
  status: ImportStatus;
  dialogState: {
    type: "customerPointsImportSummary";
    status: ImportStatus;
    count: number;
    issues?: CustomerPointsParserIssues;
  };
  trackingEvent: UserEvent;
};

const processImportResult = (
  count: number,
  issues: CustomerPointsParserIssues | null,
): ProcessImportResult => {
  let status: ImportStatus;
  if (count === 0) {
    status = "error";
  } else if (issues) {
    status = "warning";
  } else {
    status = "success";
  }

  const dialogState: CustomerPointsImportSummaryState = {
    type: "customerPointsImportSummary",
    status,
    count,
    issues: issues || undefined,
  };

  let trackingEvent: UserEvent;
  if (status === "error") {
    trackingEvent = {
      name: "importCustomerPoints.completedWithErrors",
      count,
    };
  } else if (status === "warning") {
    trackingEvent = {
      name: "importCustomerPoints.completedWithWarnings",
      count,
      issuesCount: issues ? Object.keys(issues).length : 0,
    };
  } else {
    trackingEvent = {
      name: "importCustomerPoints.completed",
      count,
    };
  }

  return { status, dialogState, trackingEvent };
};

import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { captureError } from "src/infra/error-tracking";
import { useUserTracking } from "src/infra/user-tracking";
import { parseCustomerPointsFromFile } from "src/import/customer-points";
import { dataAtom, dialogAtom } from "src/state/jotai";
import { CustomerPointsParserIssues } from "src/import/customer-points-issues";
import { UserEvent } from "src/infra/user-tracking";
import { CustomerPointsImportSummaryState } from "src/state/dialog";

const geoJsonExtension = ".geojson";
const geoJsonLExtension = ".geojsonl";

export const useImportCustomerPoints = () => {
  const data = useAtomValue(dataAtom);
  const setData = useSetAtom(dataAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();

  const { data: fsAccess } = useQuery({
    queryKey: ["browser-fs-access"],
    queryFn: async () => {
      return import("browser-fs-access");
    },
  });

  const importCustomerPoints = useCallback(
    async ({ source }: { source: string }) => {
      userTracking.capture({
        name: "importCustomerPoints.started",
        source,
      });

      if (!fsAccess) throw new Error("FS not ready");

      try {
        const file = await fsAccess.fileOpen({
          multiple: false,
          extensions: [geoJsonExtension, geoJsonLExtension],
          description: "GeoJSON/GeoJSONL Customer Points",
        });

        setDialogState({ type: "loading" });

        const text = await file.text();

        const nextId = 1;

        const parseResult = parseCustomerPointsFromFile(text, nextId);
        const { customerPoints, issues } = parseResult;

        const newCustomerPointsMap = new Map();
        customerPoints.forEach((customerPoint) => {
          newCustomerPointsMap.set(customerPoint.id, customerPoint);
        });

        setData({
          ...data,
          hydraulicModel: {
            ...data.hydraulicModel,
            customerPoints: newCustomerPointsMap,
          },
        });

        const { dialogState, trackingEvent } = processImportResult(
          customerPoints.length,
          issues,
          source,
        );

        setDialogState(dialogState);
        userTracking.capture(trackingEvent);
      } catch (error) {
        setDialogState(null);
        captureError(error as Error);
        userTracking.capture({
          name: "importCustomerPoints.completedWithErrors",
          source,
          count: 0,
        });
      }
    },
    [fsAccess, data, setData, setDialogState, userTracking],
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
  source: string,
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
      source,
      count,
    };
  } else if (status === "warning") {
    trackingEvent = {
      name: "importCustomerPoints.completedWithWarnings",
      source,
      count,
      issuesCount: issues ? Object.keys(issues).length : 0,
    };
  } else {
    trackingEvent = {
      name: "importCustomerPoints.completed",
      source,
      count,
    };
  }

  return { status, dialogState, trackingEvent };
};

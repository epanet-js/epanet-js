import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { captureError } from "src/infra/error-tracking";
import { useUserTracking } from "src/infra/user-tracking";
import { parseCustomerPointsFromFile } from "src/import/customer-points";
import { dataAtom, dialogAtom } from "src/state/jotai";

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

        const customerPoints = parseCustomerPointsFromFile(text, nextId);

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

        setDialogState({
          type: "customerPointsImportSummary",
          count: customerPoints.length,
        });

        userTracking.capture({
          name: "importCustomerPoints.completed",
          source,
          count: customerPoints.length,
        });
      } catch (error) {
        setDialogState(null);
        captureError(error as Error);
        userTracking.capture({
          name: "importCustomerPoints.completed",
          source,
          count: 0,
        });
      }
    },
    [fsAccess, data, setData, setDialogState, userTracking],
  );

  return importCustomerPoints;
};

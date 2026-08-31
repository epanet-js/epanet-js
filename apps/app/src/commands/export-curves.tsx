import { useCallback, useMemo } from "react";
import { useAtomValue } from "jotai";
import type { Curves } from "@epanet-js/hydraulic-model";
import { currentFileNameAtom } from "src/state/file-system";
import { useUserTracking } from "src/infra/user-tracking";
import { FileSystemHelpers } from "src/infra/storage";
import {
  serializeCurvesToCsv,
  serializeCurvesToXlsx,
  type ExportCurvesOptions,
} from "src/lib/operational-data-io/curves/export-curves";

export const useExportCurves = (fileSuffix: string) => {
  const { capture } = useUserTracking();
  const fullNetworkName = useAtomValue(currentFileNameAtom) ?? "";
  const networkName = useMemo(() => {
    const dot = fullNetworkName.lastIndexOf(".");
    return fullNetworkName.substring(0, dot < 0 ? fullNetworkName.length : dot);
  }, [fullNetworkName]);

  const exportToCsv = useCallback(
    async (curves: Curves, options: ExportCurvesOptions) => {
      await FileSystemHelpers.downloadFile(
        `${networkName}-${fileSuffix}.csv`,
        serializeCurvesToCsv(curves, options),
      );
      capture({ name: "curves.exported", format: "csv", count: curves.size });
    },
    [networkName, fileSuffix, capture],
  );

  const exportToXlsx = useCallback(
    async (curves: Curves, options: ExportCurvesOptions) => {
      await FileSystemHelpers.downloadFile(
        `${networkName}-${fileSuffix}.xlsx`,
        await serializeCurvesToXlsx(curves, options),
      );
      capture({ name: "curves.exported", format: "xlsx", count: curves.size });
    },
    [networkName, fileSuffix, capture],
  );

  return { exportToCsv, exportToXlsx };
};

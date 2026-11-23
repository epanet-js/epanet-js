import { useCallback, useMemo } from "react";
import { useAtomValue } from "jotai";
import type { PipeMaterial } from "@epanet-js/hydraulic-model";
import { currentFileNameAtom } from "src/state/file-system";
import { useUserTracking } from "src/infra/user-tracking";
import { FileSystemHelpers } from "src/infra/storage";
import { serializeMaterialsToCsv } from "src/lib/operational-data-io/pipe-library/export-csv";
import { serializeMaterialsToXlsx } from "src/lib/operational-data-io/pipe-library/export-xlsx";

export const useExportPipeLibrary = () => {
  const { capture } = useUserTracking();
  const fullNetworkName = useAtomValue(currentFileNameAtom) ?? "";
  const networkName = useMemo(() => {
    const dot = fullNetworkName.lastIndexOf(".");
    return fullNetworkName.substring(0, dot < 0 ? fullNetworkName.length : dot);
  }, [fullNetworkName]);

  const exportToCsv = useCallback(
    async (materials: PipeMaterial[]) => {
      await FileSystemHelpers.downloadFile(
        `${networkName}-pipe-library.csv`,
        serializeMaterialsToCsv(materials),
      );
      capture({ name: "pipeLibrary.exported", format: "csv" });
    },
    [networkName, capture],
  );

  const exportToXlsx = useCallback(
    async (materials: PipeMaterial[]) => {
      await FileSystemHelpers.downloadFile(
        `${networkName}-pipe-library.xlsx`,
        await serializeMaterialsToXlsx(materials),
      );
      capture({ name: "pipeLibrary.exported", format: "xlsx" });
    },
    [networkName, capture],
  );

  return { exportToCsv, exportToXlsx };
};

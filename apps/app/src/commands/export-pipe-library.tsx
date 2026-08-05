import { useCallback, useMemo } from "react";
import { useAtomValue } from "jotai";
import type { PipeMaterial } from "@epanet-js/hydraulic-model";
import { currentFileNameAtom } from "src/state/file-system";
import { useUserTracking } from "src/infra/user-tracking";
import { FileSystemHelpers } from "src/infra/storage";
import {
  serializeMaterialsToCsv,
  serializeMaterialsToXlsx,
} from "src/hydraulic-model/pipe-materials";

const downloadFile = async (
  fileName: string,
  contents: string | Uint8Array,
): Promise<void> => {
  const handle = await FileSystemHelpers.openFileInOpfs(fileName);
  const writable = await handle.createWritable();
  await writable.write(contents);
  await writable.close();
  await FileSystemHelpers.triggerDownload(fileName, handle);
};

export const useExportPipeLibrary = () => {
  const { capture } = useUserTracking();
  const fullNetworkName = useAtomValue(currentFileNameAtom) ?? "";
  const networkName = useMemo(() => {
    const dot = fullNetworkName.lastIndexOf(".");
    return fullNetworkName.substring(0, dot < 0 ? fullNetworkName.length : dot);
  }, [fullNetworkName]);

  const exportToCsv = useCallback(
    async (materials: PipeMaterial[]) => {
      await downloadFile(
        `${networkName}-pipe-library.csv`,
        serializeMaterialsToCsv(materials),
      );
      capture({ name: "pipeLibrary.exported", format: "csv" });
    },
    [networkName, capture],
  );

  const exportToXlsx = useCallback(
    async (materials: PipeMaterial[]) => {
      await downloadFile(
        `${networkName}-pipe-library.xlsx`,
        await serializeMaterialsToXlsx(materials),
      );
      capture({ name: "pipeLibrary.exported", format: "xlsx" });
    },
    [networkName, capture],
  );

  return { exportToCsv, exportToXlsx };
};

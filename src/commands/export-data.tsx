import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { Export, ExportFormat } from "src/lib/export";
import { notifyPromiseState } from "src/components/notifications";
import { useTranslate } from "src/hooks/use-translate";

export type DataExportOptions = {
  format: ExportFormat;
  includeSimulationResults: boolean;
};

export const useExportData = () => {
  const translate = useTranslate();

  const exportNetwork = useAtomCallback(
    useCallback(
      async (_get, _set, options: DataExportOptions) => {
        const data = {};

        const doExport = (): Promise<void> => {
          Export.exportFile(options.format, [data]);
          return Promise.reject(
            new Error(
              `Export format "${options.format}" is not yet implemented`,
            ),
          );
        };

        try {
          await notifyPromiseState(doExport(), {
            loading: translate("exporting"),
            success: translate("exported"),
            error: translate("exportFailed"),
          });
        } catch {}
      },
      [translate],
    ),
  );

  return exportNetwork;
};

import { useCallback } from "react";
import { fileOpen } from "browser-fs-access";
import type { CurveType } from "@epanet-js/hydraulic-model";
import { useUserTracking } from "src/infra/user-tracking";
import {
  parseCurvesFile,
  type MessageOverrides,
  type ParseCurvesResult,
} from "src/lib/operational-data-io/curves/parse-curves-file";
import type { CurveTypeLabels } from "src/lib/operational-data-io/curves/export-curves";

const openFilePicker = async (): Promise<File | null> => {
  try {
    return await fileOpen({
      extensions: [".csv", ".xlsx"],
      description: "Curves file",
      mimeTypes: [
        "text/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") return null;
    throw error;
  }
};

export const useImportCurves = () => {
  const { capture } = useUserTracking();

  return useCallback(
    async (options: {
      scope: CurveType[];
      typeLabels: CurveTypeLabels;
      axisLabels: { x: string; y: string };
      messageOverrides?: MessageOverrides;
    }): Promise<ParseCurvesResult | null> => {
      const file = await openFilePicker();
      if (!file) return null;

      const result = await parseCurvesFile(file, options);
      capture({
        name: "curves.importedFromFile",
        status: result.status,
        format: result.format,
        count: result.curves.length,
      });
      return result;
    },
    [capture],
  );
};

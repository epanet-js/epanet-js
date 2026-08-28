import { useCallback } from "react";
import { fileOpen } from "browser-fs-access";
import { useUserTracking } from "src/infra/user-tracking";
import {
  parsePatternsFile,
  type ParsePatternsResult,
} from "src/lib/operational-data-io/patterns/parse-patterns-file";
import type { PatternTypeLabels } from "src/lib/operational-data-io/patterns/export-patterns";

const openFilePicker = async (): Promise<File | null> => {
  try {
    return await fileOpen({
      extensions: [".csv", ".xlsx"],
      description: "Patterns file",
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

export const useImportPatterns = () => {
  const { capture } = useUserTracking();

  return useCallback(
    async (labels: PatternTypeLabels): Promise<ParsePatternsResult | null> => {
      const file = await openFilePicker();
      if (!file) return null;

      const result = await parsePatternsFile(file, labels);
      capture({
        name: "patterns.importedFromFile",
        status: result.status,
        format: result.format,
        count: result.patterns.length,
      });
      return result;
    },
    [capture],
  );
};

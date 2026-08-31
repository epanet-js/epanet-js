import { useCallback, useMemo } from "react";
import { LabelManager } from "@epanet-js/hydraulic-model";
import { Patterns } from "src/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  ImportExportToolbar,
  type ImportOutcome,
} from "src/components/import-export-toolbar";
import { useExportPatterns } from "src/commands/export-patterns";
import { useImportPatterns } from "src/commands/import-patterns";
import {
  buildImportOutcome,
  describeErrors,
} from "src/components/import-outcome";
import { mergePatterns } from "src/lib/operational-data-io/patterns/merge-patterns";
import { buildPatternTypeLabels, PATTERN_TYPES } from "./pattern-type-labels";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";

const KEYS = "patterns.import";

export const ImportExportPatternsToolbar = ({
  patterns,
  intervalSeconds,
  onImported,
  onImportingChange,
  readOnly = false,
}: {
  patterns: Patterns;
  intervalSeconds: number;
  onImported: (patterns: Patterns) => void;
  onImportingChange?: (isImporting: boolean) => void;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const isEnabled = useFeatureFlag("FLAG_PATTERNS_IMPORT_EXPORT");
  const { exportToCsv, exportToXlsx } = useExportPatterns(
    translate("patterns.title"),
  );
  const importPatterns = useImportPatterns();

  const options = useMemo(
    () => ({
      typeOrder: PATTERN_TYPES,
      typeLabels: buildPatternTypeLabels(translate),
      intervalSeconds,
      headers: {
        patternName: translate("patterns.patternName"),
        type: translate("type"),
        interval: translate("patterns.interval"),
        multipliers: translate("patterns.multipliers"),
      },
    }),
    [translate, intervalSeconds],
  );

  const handleExportCsv = useCallback(
    () => void exportToCsv(patterns, options),
    [exportToCsv, patterns, options],
  );

  const handleExportXlsx = useCallback(
    () => void exportToXlsx(patterns, options),
    [exportToXlsx, patterns, options],
  );

  const handleImport = useCallback(async (): Promise<ImportOutcome | null> => {
    const parsed = await importPatterns(options.typeLabels);
    if (!parsed) return null;

    if (parsed.status === "error") {
      // The first reason is the headline; any others are detail, and belong
      // in the same expandable section the warning case uses.
      const [message, ...rest] = describeErrors(parsed.errors, translate, KEYS);

      return {
        status: "failed",
        message: message ?? translate("fileReadError"),
        issues: rest.length
          ? { summary: translate(`${KEYS}.issues`), lines: rest }
          : undefined,
      };
    }

    const labelManager = new LabelManager();
    let maxId: number = 0;
    for (const pattern of patterns.values()) {
      labelManager.register(pattern.label, "pattern", pattern.id);
      if (pattern.id > maxId) maxId = pattern.id;
    }

    const idGenerator = new ConsecutiveIdsGenerator(maxId);

    const merged = mergePatterns(patterns, parsed.patterns, {
      labelManager,
      idGenerator,
    });

    onImported(merged.patterns);

    const intervalIgnored = parsed.patterns.some(
      (pattern) =>
        pattern.intervalSeconds !== undefined &&
        pattern.intervalSeconds !== intervalSeconds,
    );

    return buildImportOutcome({
      keys: KEYS,
      counts: merged.counts,
      ignored: parsed.ignored,
      errors: parsed.errors,
      extraIssues: intervalIgnored
        ? [translate(`${KEYS}.intervalIgnored`)]
        : [],
      translate,
    });
  }, [
    importPatterns,
    options.typeLabels,
    patterns,
    intervalSeconds,
    onImported,
    translate,
  ]);

  if (!isEnabled) return null;

  return (
    <ImportExportToolbar
      onExportCsv={handleExportCsv}
      onExportXlsx={handleExportXlsx}
      onImport={handleImport}
      onImportingChange={onImportingChange}
      readOnly={readOnly}
    />
  );
};

import { useCallback, useMemo } from "react";
import { LabelManager } from "@epanet-js/hydraulic-model";
import { Patterns } from "src/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { ImportExportToolbar } from "src/components/import-export-toolbar";
import { useExportPatterns } from "src/commands/export-patterns";
import { useImportPatterns } from "src/commands/import-patterns";
import {
  buildImportOutcome,
  describeIssue,
  groupErrors,
  type ImportOutcome,
} from "src/components/import-outcome";
import { captureError } from "src/infra/error-tracking";
import { mergePatterns } from "src/lib/operational-data-io/patterns/merge-patterns";
import { buildPatternTypeLabels, PATTERN_TYPES } from "./pattern-type-labels";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";

export const PATTERNS_IMPORT_KEYS = "patterns.import";

export const ImportExportPatternsToolbar = ({
  patterns,
  intervalSeconds,
  onImported,
  isImporting,
  onImportingChange,
  readOnly = false,
}: {
  patterns: Patterns;
  intervalSeconds: number;
  // The merged draft, or null when the file gave us nothing to merge, along
  // with the report to show for it.
  onImported: (patterns: Patterns | null, outcome: ImportOutcome) => void;
  isImporting: boolean;
  onImportingChange: (isImporting: boolean) => void;
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

  const runImport = useCallback(async (): Promise<void> => {
    const parsed = await importPatterns(options.typeLabels);
    if (!parsed) return;

    if (parsed.status === "error") {
      // The first reason is the headline; any others are detail, and belong
      // in the same expandable section the warning case uses.
      const [first, ...rest] = groupErrors(parsed.errors);

      onImported(null, {
        status: "failed",
        message: first
          ? describeIssue(first, translate, PATTERNS_IMPORT_KEYS)
          : translate("fileReadError"),
        issues: rest,
      });
      return;
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

    const intervalIgnored = parsed.patterns.some(
      (pattern) =>
        pattern.intervalSeconds !== undefined &&
        pattern.intervalSeconds !== intervalSeconds,
    );

    onImported(
      merged.patterns,
      buildImportOutcome({
        keysNamespace: PATTERNS_IMPORT_KEYS,
        counts: merged.counts,
        ignored: parsed.ignored,
        errors: parsed.errors,
        extraIssues: intervalIgnored ? ["intervalIgnored"] : [],
        translate,
      }),
    );
  }, [
    importPatterns,
    options.typeLabels,
    patterns,
    intervalSeconds,
    onImported,
    translate,
  ]);

  const handleImport = useCallback(() => {
    onImportingChange(true);
    void runImport()
      .catch((error: Error) => {
        captureError(error);
        onImported(null, {
          status: "failed",
          message: translate("fileReadError"),
        });
      })
      .finally(() => onImportingChange(false));
  }, [runImport, onImported, onImportingChange, translate]);

  if (!isEnabled) return null;

  return (
    <ImportExportToolbar
      onExportCsv={handleExportCsv}
      onExportXlsx={handleExportXlsx}
      onImport={handleImport}
      disabled={isImporting}
      readOnly={readOnly}
    />
  );
};

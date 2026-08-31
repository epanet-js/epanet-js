import { Fragment, useCallback, useMemo } from "react";
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
import type {
  ImportCounts,
  ImportError,
} from "src/lib/operational-data-io/import-result";
import { mergePatterns } from "src/lib/operational-data-io/patterns/merge-patterns";
import type { ParsePatternsResult } from "src/lib/operational-data-io/patterns/parse-patterns-file";
import { buildPatternTypeLabels, PATTERN_TYPES } from "./pattern-type-labels";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";

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
      const [message, ...rest] = describeErrors(parsed.errors, translate);

      return {
        status: "failed",
        message: message ?? translate("fileReadError"),
        issues: rest.length
          ? { summary: translate("patterns.import.issues"), lines: rest }
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

    return buildImportOutcome(
      parsed,
      merged.counts,
      intervalSeconds,
      translate,
    );
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

const MAX_LISTED_ROWS = 5;

// One line per kind of problem, naming the rows it happened on — a file with
// fifty bad rows reads as two lines, not fifty. File-level problems carry no
// row and are reported on their own.
const describeErrors = (
  errors: ImportError[],
  translate: (key: string, ...args: string[]) => string,
): string[] => {
  const rowsByMessage = new Map<string, number[]>();

  for (const error of errors) {
    const rows = rowsByMessage.get(error.message) ?? [];
    if (error.row !== undefined) rows.push(error.row);
    rowsByMessage.set(error.message, rows);
  }

  return [...rowsByMessage.entries()].map(([message, rows]) => {
    const text = translate(message);
    if (rows.length === 0) return text;

    if (rows.length === 1) {
      return translate("patterns.import.atRow", text, String(rows[0]));
    }

    const listed = rows.slice(0, MAX_LISTED_ROWS).join(", ");
    const remaining = rows.length - MAX_LISTED_ROWS;

    return translate(
      "patterns.import.atRows",
      text,
      remaining > 0
        ? translate("patterns.import.andMoreRows", listed, String(remaining))
        : listed,
    );
  });
};

const buildImportOutcome = (
  parsed: ParsePatternsResult,
  counts: ImportCounts,
  modelIntervalSeconds: number,
  translate: (key: string, ...args: string[]) => string,
): ImportOutcome => {
  // Only the categories that actually happened, so "9 added" is not padded
  // out with zeroes. Ignored is emphasised as the one worth acting on.
  const parts = (
    [
      ["added", counts.added, false],
      ["updated", counts.updated, false],
      ["identical", counts.identical, false],
      ["ignored", parsed.ignored, true],
      ["untouched", counts.untouched, false],
    ] as const
  )
    .filter(([, count]) => count > 0)
    .map(([key, count, emphasised]) => ({
      key,
      emphasised,
      text: translate(`patterns.import.${key}`, String(count)),
    }));

  const intervalIgnored = parsed.patterns.some(
    (pattern) =>
      pattern.intervalSeconds !== undefined &&
      pattern.intervalSeconds !== modelIntervalSeconds,
  );

  const issues = [
    ...(intervalIgnored ? [translate("patterns.import.intervalIgnored")] : []),
    ...describeErrors(parsed.errors, translate),
  ];

  const summary = parts.map((part) => part.text).join(", ");

  // Nothing to flag: the summary is the whole story. An import that left the
  // library as it found it is information rather than a success.
  if (issues.length === 0) {
    if (counts.added > 0 || counts.updated > 0) {
      return {
        status: "success",
        message: translate("patterns.import.imported"),
        notes: [summary],
      };
    }

    return {
      status: "info",
      message: translate("patterns.import.nothingImported"),
      // An empty file has nothing to break down.
      notes: summary ? [summary] : undefined,
    };
  }

  return {
    status: "warning",
    message: translate("patterns.import.issuesFound"),
    notes: parts.length
      ? [
          parts.map((part, index) => (
            <Fragment key={part.key}>
              {index > 0 ? ", " : null}
              {part.emphasised ? (
                <span className="font-semibold text-warning">{part.text}</span>
              ) : (
                part.text
              )}
            </Fragment>
          )),
        ]
      : undefined,
    issues: { summary: translate("patterns.import.issues"), lines: issues },
  };
};

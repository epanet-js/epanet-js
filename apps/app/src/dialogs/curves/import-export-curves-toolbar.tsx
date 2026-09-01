import { useCallback, useMemo } from "react";
import {
  LabelManager,
  type CurveType,
  type Curves,
} from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { ImportExportToolbar } from "src/components/import-export-toolbar";
import {
  buildImportOutcome,
  describeIssue,
  groupErrors,
  type ImportOutcome,
} from "src/components/import-outcome";
import { captureError } from "src/infra/error-tracking";
import { useExportCurves } from "src/commands/export-curves";
import { useImportCurves } from "src/commands/import-curves";
import { mergeCurves } from "src/lib/operational-data-io/curves/merge-curves";
import type { CodeOverrides } from "src/lib/operational-data-io/curves/parse-curves-file";
import { buildCurveTypeLabels } from "./curve-type-labels";

export const CURVES_IMPORT_KEYS = "curves.import";

export const ImportExportCurvesToolbar = ({
  curves,
  scope,
  codeOverrides,
  fileSuffix,
  onImported,
  isImporting,
  onImportingChange,
  readOnly = false,
}: {
  curves: Curves;
  // The types this dialog owns; untyped curves always travel with them.
  scope: CurveType[];
  // Wording this dialog states more precisely than the generic default —
  // which library a foreign curve belongs to, for instance.
  codeOverrides?: CodeOverrides;
  fileSuffix: string;
  // The merged draft, or null when the file gave us nothing to merge, along
  // with the report to show for it.
  onImported: (curves: Curves | null, outcome: ImportOutcome) => void;
  isImporting: boolean;
  onImportingChange: (isImporting: boolean) => void;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const isEnabled = useFeatureFlag("FLAG_CURVES_IMPORT_EXPORT");
  const { exportToCsv, exportToXlsx } = useExportCurves(fileSuffix);
  const importCurves = useImportCurves();

  const options = useMemo(
    () => ({
      scope,
      typeLabels: buildCurveTypeLabels(translate),
      axisLabels: { x: translate("x"), y: translate("y") },
      headers: {
        curveName: translate("curves.curveName"),
        type: translate("type"),
        axis: translate("curves.axis"),
        values: translate("values"),
      },
    }),
    [translate, scope],
  );

  const handleExportCsv = useCallback(
    () => void exportToCsv(curves, options),
    [exportToCsv, curves, options],
  );

  const handleExportXlsx = useCallback(
    () => void exportToXlsx(curves, options),
    [exportToXlsx, curves, options],
  );

  const runImport = useCallback(async (): Promise<void> => {
    const parsed = await importCurves({
      scope: options.scope,
      typeLabels: options.typeLabels,
      axisLabels: options.axisLabels,
      codeOverrides,
    });
    if (!parsed) return;

    if (parsed.status === "error") {
      // The first reason is the headline; any others are detail, and belong
      // in the same expandable section the warning case uses.
      const [first, ...rest] = groupErrors(parsed.errors);

      onImported(null, {
        status: "failed",
        message: first
          ? describeIssue(first, translate, CURVES_IMPORT_KEYS)
          : translate("fileReadError"),
        issues: rest,
      });
      return;
    }

    const labelManager = new LabelManager();
    let maxId = 0;
    for (const curve of curves.values()) {
      labelManager.register(curve.label, "curve", curve.id);
      if (curve.id > maxId) maxId = curve.id;
    }

    const merged = mergeCurves(curves, parsed.curves, {
      labelManager,
      idGenerator: new ConsecutiveIdsGenerator(maxId),
      scope: options.scope,
    });

    onImported(
      merged.curves,
      buildImportOutcome({
        keysNamespace: CURVES_IMPORT_KEYS,
        counts: merged.counts,
        ignored: parsed.ignored,
        errors: parsed.errors,
        translate,
      }),
    );
  }, [importCurves, options, codeOverrides, curves, onImported, translate]);

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

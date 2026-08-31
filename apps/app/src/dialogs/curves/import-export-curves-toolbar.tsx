import { useCallback, useMemo } from "react";
import {
  LabelManager,
  type CurveType,
  type Curves,
} from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  ImportExportToolbar,
  type ImportOutcome,
} from "src/components/import-export-toolbar";
import {
  buildImportOutcome,
  describeErrors,
} from "src/components/import-outcome";
import { useExportCurves } from "src/commands/export-curves";
import { useImportCurves } from "src/commands/import-curves";
import { mergeCurves } from "src/lib/operational-data-io/curves/merge-curves";
import type { MessageOverrides } from "src/lib/operational-data-io/curves/parse-curves-file";
import { buildCurveTypeLabels } from "./curve-type-labels";

const KEYS = "curves.import";

export const ImportExportCurvesToolbar = ({
  curves,
  scope,
  messageOverrides,
  fileSuffix,
  onImported,
  onImportingChange,
  readOnly = false,
}: {
  curves: Curves;
  // The types this dialog owns; untyped curves always travel with them.
  scope: CurveType[];
  // Wording this dialog states more precisely than the generic default —
  // which library a foreign curve belongs to, for instance.
  messageOverrides?: MessageOverrides;
  fileSuffix: string;
  onImported: (curves: Curves) => void;
  onImportingChange?: (isImporting: boolean) => void;
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

  const handleImport = useCallback(async (): Promise<ImportOutcome | null> => {
    const parsed = await importCurves({
      scope: options.scope,
      typeLabels: options.typeLabels,
      axisLabels: options.axisLabels,
      messageOverrides,
    });
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
    let maxId = 0;
    for (const curve of curves.values()) {
      labelManager.register(curve.label, "curve", curve.id);
      if (curve.id > maxId) maxId = curve.id;
    }

    const merged = mergeCurves(curves, parsed.curves, {
      labelManager,
      idGenerator: new ConsecutiveIdsGenerator(maxId),
    });

    onImported(merged.curves);

    return buildImportOutcome({
      keys: KEYS,
      counts: merged.counts,
      ignored: parsed.ignored,
      errors: parsed.errors,
      translate,
    });
  }, [importCurves, options, messageOverrides, curves, onImported, translate]);

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

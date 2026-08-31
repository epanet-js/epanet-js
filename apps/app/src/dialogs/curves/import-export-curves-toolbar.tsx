import { useCallback, useMemo } from "react";
import type { CurveType, Curves } from "@epanet-js/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { ImportExportToolbar } from "src/components/import-export-toolbar";
import { useExportCurves } from "src/commands/export-curves";
import { buildCurveTypeLabels } from "./curve-type-labels";

export const ImportExportCurvesToolbar = ({
  curves,
  scope,
  fileSuffix,
  readOnly = false,
}: {
  curves: Curves;
  scope: CurveType[];
  fileSuffix: string;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const isEnabled = useFeatureFlag("FLAG_CURVES_IMPORT_EXPORT");
  const { exportToCsv, exportToXlsx } = useExportCurves(fileSuffix);

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

  if (!isEnabled) return null;

  return (
    <ImportExportToolbar
      onExportCsv={handleExportCsv}
      onExportXlsx={handleExportXlsx}
      readOnly={readOnly}
    />
  );
};

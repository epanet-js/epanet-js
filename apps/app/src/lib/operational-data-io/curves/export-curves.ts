import type { CurveType, Curves, ICurve } from "@epanet-js/hydraulic-model";
import { serializeToCsv, serializeToXlsx, type Row } from "../table-file";

export type CurveTypeLabels = Record<CurveType, string>;

export type ExportCurvesOptions = {
  // The types this dialog owns. Untyped curves are always included: both
  // curve dialogs list them, so both export them.
  scope: CurveType[];
  typeLabels: CurveTypeLabels;
  axisLabels: { x: string; y: string };
  headers: {
    curveName: string;
    type: string;
    axis: string;
    values: string;
  };
};

const inScope = (curve: ICurve, scope: CurveType[]): boolean =>
  !curve.type || scope.includes(curve.type);

export const buildCurveRows = (
  curves: Curves,
  { scope, typeLabels, axisLabels, headers }: ExportCurvesOptions,
): Row[] => {
  const header: Row = [
    headers.curveName,
    headers.type,
    headers.axis,
    headers.values,
  ];

  const rank = (curve: ICurve): number =>
    curve.type ? scope.indexOf(curve.type) : scope.length;

  const rows = [...curves.values()]
    .filter((curve) => inScope(curve, scope))
    .sort((a, b) => rank(a) - rank(b))
    .flatMap((curve): Row[] => {
      const type = curve.type ? typeLabels[curve.type] : "";

      return [
        [curve.label, type, axisLabels.x, ...curve.points.map((p) => p.x)],
        [curve.label, type, axisLabels.y, ...curve.points.map((p) => p.y)],
      ];
    });

  return [header, ...rows];
};

export const serializeCurvesToCsv = (
  curves: Curves,
  options: ExportCurvesOptions,
): string => serializeToCsv(buildCurveRows(curves, options));

export const serializeCurvesToXlsx = (
  curves: Curves,
  options: ExportCurvesOptions,
): Promise<Uint8Array> =>
  serializeToXlsx("Curves", buildCurveRows(curves, options));

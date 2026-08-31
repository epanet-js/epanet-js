import type { Pattern, PatternType, Patterns } from "src/hydraulic-model";
import { serializeToCsv, serializeToXlsx, type Row } from "../table-file";
import { formatSecondsToDisplay } from "src/components/form/time-field";

export type PatternTypeLabels = Record<PatternType, string>;

export type ExportPatternsOptions = {
  typeOrder: PatternType[];
  typeLabels: PatternTypeLabels;
  intervalSeconds: number;
  headers: {
    patternName: string;
    type: string;
    interval: string;
    multipliers: string;
  };
};

export const buildPatternRows = (
  patterns: Patterns,
  { typeOrder, typeLabels, intervalSeconds, headers }: ExportPatternsOptions,
): Row[] => {
  const interval = formatSecondsToDisplay(intervalSeconds);

  const header: Row = [
    headers.patternName,
    headers.type,
    headers.interval,
    headers.multipliers,
  ];

  const rank = (pattern: Pattern): number =>
    pattern.type ? typeOrder.indexOf(pattern.type) : typeOrder.length;

  const rows = [...patterns.values()]
    .sort((a, b) => rank(a) - rank(b))
    .map(
      (pattern): Row => [
        pattern.label,
        pattern.type ? typeLabels[pattern.type] : "",
        interval,
        ...pattern.multipliers,
      ],
    );

  return [header, ...rows];
};

export const serializePatternsToCsv = (
  patterns: Patterns,
  options: ExportPatternsOptions,
): string => serializeToCsv(buildPatternRows(patterns, options));

export const serializePatternsToXlsx = (
  patterns: Patterns,
  options: ExportPatternsOptions,
): Promise<Uint8Array> =>
  serializeToXlsx("Patterns", buildPatternRows(patterns, options));

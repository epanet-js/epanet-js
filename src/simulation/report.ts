import { Asset, AssetsMap, AssetId } from "src/hydraulic-model";
import { ReportErrorCollector } from "./report-error-collector";

export type ReportRow = {
  text: string;
  assetSlots: AssetId[];
};

export type ProcessedReport = ReportRow[];

export type ProcessReportResult = {
  processedReport: ProcessedReport;
  errorCollector: ReportErrorCollector;
};

const valvesSectionRowRegExp =
  /^\s*(\d+)\t(\d+)\t(\d+)\t[\d.]+\t(?:PRV|PSV|TCV|FCV|PBV|GPV|CV)\t/i;
const pipesSectionRowRegExp =
  /^\s*(\S+)\s+(\S+)\s+(\S+)\s+[\d.]+\s+[\d.]+\s+[\d.]+/;
const pumpsSectionRowRegExp =
  /^\s*(\S+)\s+(\S+)\s+(\S+)\s+(?:HEAD|POWER|SPEED|PATTERN)\b/i;
const valveTypeRegExp = /(?:PRV|PSV|TCV|FCV|PBV|GPV|CV)\s+(\d+)(?=\s+[a-z])/i;
const errorMessageRegExp = /Error \d{3}:.*?\b(\d+)\b/;
const assetReferenceRegExp =
  /(?:Link|Junction|Pipe|Reservoir|Node|Valve|Pump|Tank|node)\s+(\d+)/gi;

const skipRegexp = [/Error 213/, /Error 211/];

const idRegExps = [
  valvesSectionRowRegExp,
  pipesSectionRowRegExp,
  pumpsSectionRowRegExp,
  valveTypeRegExp,
  errorMessageRegExp,
  assetReferenceRegExp,
];

export const processReportWithSlots = (
  report: string,
  assets: AssetsMap,
): ProcessReportResult => {
  const errorCollector = new ReportErrorCollector();

  const processedReport = report.split("\n").map((row) => {
    const isSkipped = skipRegexp.find((regexp) => regexp.test(row));
    if (isSkipped) {
      return { text: row, assetSlots: [] };
    }

    let processedText = row;
    const assetSlots: AssetId[] = [];
    let slotIndex = 0;

    for (const regexp of idRegExps) {
      processedText = processedText.replace(regexp, (match, ...capturedIds) => {
        let result = match;
        let offsetAdjustment = 0;

        for (const id of capturedIds) {
          const asset = assets.get(id) as Asset;
          if (!asset) {
            errorCollector.collectMissingAssetId(
              row,
              match,
              id,
              regexp.toString(),
            );
            continue;
          }

          const groupIndexInMatch = result.indexOf(id, offsetAdjustment);
          if (groupIndexInMatch === -1) continue;

          const beforeId = result.slice(0, groupIndexInMatch);
          const afterId = result.slice(groupIndexInMatch + id.length);
          const slotMarker = `{{${slotIndex}}}`;

          assetSlots.push(asset.id);
          slotIndex++;

          result = beforeId + slotMarker + afterId;
          offsetAdjustment = groupIndexInMatch + slotMarker.length;
        }

        return result;
      });
    }

    return { text: processedText, assetSlots };
  });

  return { processedReport, errorCollector };
};

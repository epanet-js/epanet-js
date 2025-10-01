import { Asset, AssetsMap, AssetId } from "src/hydraulic-model";
import { ReportErrorCollector } from "./report-error-collector";

export type ReportRow = {
  text: string;
  assetSlots: AssetId[];
};

export type ProcessedReport = ReportRow[];

const valveTypeRegExp = /(?:PRV|PSV|TCV|FCV|PBV|GPV|CV)\s+(\d+)(?=\s+[a-z])/i;
const errorMessageRegExp = /Error \d{3}:.*?\b(\d+)\b/;
const assetReferenceRegExp =
  /(?:Link|Junction|Pipe|Reservoir|Node|Valve|Pump|Tank|node)\s+(\d+)/gi;

const skipRegexp = [/Error 213/, /Error 211/];

const idRegExps = [valveTypeRegExp, errorMessageRegExp, assetReferenceRegExp];

export const processReportWithSlots = (
  report: string,
  assets: AssetsMap,
): ProcessedReport => {
  const errorCollector = new ReportErrorCollector();

  const result = report.split("\n").map((row) => {
    const isSkipped = skipRegexp.find((regexp) => regexp.test(row));
    if (isSkipped) {
      return { text: row, assetSlots: [] };
    }

    let processedText = row;
    const assetSlots: AssetId[] = [];
    let slotIndex = 0;

    for (const regexp of idRegExps) {
      processedText = processedText.replace(regexp, (match, id) => {
        const asset = assets.get(id) as Asset;
        if (!asset) {
          errorCollector.collectMissingAssetId(
            row,
            match,
            id,
            regexp.toString(),
          );
          return match;
        }

        const groupIndexInMatch = match.lastIndexOf(id);
        const beforeId = match.slice(0, groupIndexInMatch);
        const afterId = match.slice(groupIndexInMatch + id.length);
        const slotMarker = `{{${slotIndex}}}`;

        assetSlots.push(asset.id);
        slotIndex++;

        return beforeId + slotMarker + afterId;
      });
    }

    return { text: processedText, assetSlots };
  });

  errorCollector.flushErrors();

  return result;
};

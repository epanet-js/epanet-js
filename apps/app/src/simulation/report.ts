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

const MISSING_VALUE = "MISSING";

const numberOrMissing = `(?:[\\d.]+|${MISSING_VALUE})`;
const assetIdOrMissing = `(\\d+|${MISSING_VALUE})`;
const valvesSectionRowRegExp = new RegExp(
  `^\\s*${assetIdOrMissing}\\s+${assetIdOrMissing}\\s+${assetIdOrMissing}\\s+${numberOrMissing}\\s+(?:PRV|PSV|TCV|FCV|PBV|GPV|PCV|CV)\\s+`,
  "i",
);
const pipesSectionRowRegExp = new RegExp(
  `^\\s*${assetIdOrMissing}\\s+${assetIdOrMissing}\\s+${assetIdOrMissing}\\s+${numberOrMissing}\\s+${numberOrMissing}\\s+\\S+`,
);
const pumpsSectionRowRegExp = new RegExp(
  `^\\s*${assetIdOrMissing}\\s+${assetIdOrMissing}\\s+${assetIdOrMissing}\\s+(?:HEAD|POWER|SPEED|PATTERN)\\b`,
  "i",
);
const valveTypeRegExp =
  /(?:PRV|PSV|TCV|FCV|PBV|GPV|PCV|CV)\s+(\d+)(?=\s+[a-z])/i;
const nonAssetNumberPrefixes =
  "Rule|line|value|level|trial|trials|step|section|curve";
const notPartOfDecimal = `(?<!\\d\\.)`;
const notFollowedByDecimals = `(?!\\.\\d)`;
const errorMessageRegExp = new RegExp(
  `Error \\d{3}:.*?(?<!(?:${nonAssetNumberPrefixes})\\s)${notPartOfDecimal}\\b(\\d+)\\b${notFollowedByDecimals}`,
);
const assetReferenceRegExp =
  /(?:Link|Junction|Pipe|Reservoir|Node|Valve|Pump|Tank|node)\s+(\d+)/gi;

const skipRegexp = [/Error 213/, /Error 211/, /Error 202/, /Error 208/];

const sectionRowRegExps = [
  valvesSectionRowRegExp,
  pipesSectionRowRegExp,
  pumpsSectionRowRegExp,
  valveTypeRegExp,
  errorMessageRegExp,
  assetReferenceRegExp,
];

const errorLineRegExp = /^\s*(?:Input\s+)?Error \d{3}:/;
const errorLineRegExps = [errorMessageRegExp, assetReferenceRegExp];

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

    const regExps = errorLineRegExp.test(row)
      ? errorLineRegExps
      : sectionRowRegExps;

    for (const regexp of regExps) {
      processedText = processedText.replace(regexp, (match, ...capturedIds) => {
        let result = match;
        let offsetAdjustment = 0;

        const actualCapturedIds = capturedIds.filter(
          (arg, index, array): arg is string =>
            typeof arg === "string" && index < array.length - 2,
        );

        for (const id of actualCapturedIds) {
          if (id === MISSING_VALUE) {
            continue;
          }

          const numericId = parseInt(id, 10);
          const asset = assets.get(numericId) as Asset;
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

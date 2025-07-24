import { Asset, AssetsMap } from "src/hydraulic-model";
import { captureWarning } from "src/infra/error-tracking";

const valveTypeRegExp = /(?:PRV|PSV|TCV|FCV|PBV|GPV)\s+(\d+)/i;
const errorMessageRegExp = /Error \d{3}:.*?\b(\d+)\b/;
const assetReferenceRegExp =
  /(?:Link|Junction|Pipe|Reservoir|Node|Valve|Pump|Tank|node)\s+(\d+)/gi;

const skipRegexp = [/Error 213/, /Error 211/];

const idRegExps = [valveTypeRegExp, errorMessageRegExp, assetReferenceRegExp];

export const replaceIdWithLabels = (
  report: string,
  assets: AssetsMap,
): string => {
  const output = report
    .split("\n")
    .map((row) => {
      const isSkipped = skipRegexp.find((regexp) => regexp.test(row));
      if (isSkipped) return row;

      const regexp = idRegExps.find((regexp) => regexp.test(row));
      if (!regexp) return row;

      return row.replace(regexp, (match, id) => {
        const asset = assets.get(id) as Asset;
        if (!asset) {
          captureWarning(
            `Asset ID '${id}' referenced in report (${match}) but not found in model`,
          );
          return match; // Return unchanged if asset not found
        }

        const groupIndexInMatch = match.lastIndexOf(id);
        return (
          match.slice(0, groupIndexInMatch) +
          asset.label +
          match.slice(groupIndexInMatch + id.length)
        );
      });
    })
    .join("\n");

  return output;
};

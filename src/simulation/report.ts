import { Asset, AssetsMap } from "src/hydraulic-model";

const errorMessageRegExp = /Error \d{3}:.*?\b(\d+)\b/;
const assetReferenceRegExp =
  /(?:Link|Junction|Pipe|Reservoir|Node|Valve|Pump|Tank)\s+(\d+)/g;

const skipRegexp = [/Error 213/];

const idRegExps = [errorMessageRegExp, assetReferenceRegExp];

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
        return match.replace(id, asset.label);
      });
    })
    .join("\n");

  return output;
};

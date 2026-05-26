import { AssetId } from "../asset-types";
import { AssetReference, SimpleControl, RuleBasedControl } from "./types";

export type IdResolver = (assetId: AssetId) => string;

const replaceAssetPlaceholders = (
  template: string,
  assetReferences: AssetReference[],
  idResolver: IdResolver,
): string => {
  return template.replace(/\{\{(\d+)\}\}/g, (_, indexStr) => {
    const index = parseInt(indexStr, 10);
    const ref = assetReferences[index];
    if (!ref) return `{{${index}}}`;
    return idResolver(ref.assetId);
  });
};

export const formatSimpleControl = (
  control: SimpleControl,
  idResolver: IdResolver,
): string => {
  return replaceAssetPlaceholders(
    control.template,
    control.assetReferences,
    idResolver,
  );
};

export const formatRuleBasedControl = (
  rule: RuleBasedControl,
  idResolver: IdResolver,
): string => {
  let result = rule.template.replace(/\{\{id\}\}/g, rule.ruleId);
  result = replaceAssetPlaceholders(result, rule.assetReferences, idResolver);
  return result;
};

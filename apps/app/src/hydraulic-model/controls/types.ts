import { AssetId } from "../asset-types";

export type AssetReference = {
  assetId: AssetId;
  isActionTarget: boolean;
};

export type SimpleControl = {
  template: string;
  assetReferences: AssetReference[];
};

export type RuleBasedControl = {
  ruleId: string;
  template: string;
  assetReferences: AssetReference[];
};

export type Controls = {
  simple: SimpleControl[];
  rules: RuleBasedControl[];
};

export const createEmptyControls = (): Controls => ({
  simple: [],
  rules: [],
});

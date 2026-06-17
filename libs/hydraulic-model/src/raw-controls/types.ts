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

export type RawControls = {
  simple: SimpleControl[];
  rules: RuleBasedControl[];
};

export const createEmptyRawControls = (): RawControls => ({
  simple: [],
  rules: [],
});

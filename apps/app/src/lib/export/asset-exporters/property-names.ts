import {
  CustomAttributeAssetType,
  CustomAttributesDefinition,
  getAttribute,
  isCustomProperty,
} from "@epanet-js/custom-attributes";
import { TranslateFn } from "@epanet-js/i18n";

export type PropertyNameResolver = (
  assetType: CustomAttributeAssetType,
  key: string,
) => string;

export const buildPropertyNameResolver = (
  customAttributes: CustomAttributesDefinition,
  translate: TranslateFn,
): PropertyNameResolver => {
  return (assetType, key) => {
    if (isCustomProperty(key)) {
      return getAttribute(customAttributes, assetType, key)?.label ?? key;
    }
    if (key.startsWith(SIMULATION_PREFIX)) {
      const metric = key.slice(SIMULATION_PREFIX.length);
      return `${translate(metric)} (${translate("simulation")})`;
    }
    return translate(translationKeyFor(assetType, key));
  };
};

const SIMULATION_PREFIX = "sim_";

const PROPERTY_KEY_ALIASES: Record<string, string> = {
  isActive: "isEnabled",
  patternId: "timePattern",
  chemicalSourcePatternId: "chemicalSourcePattern",
  year: "yearOfInstallation",
  kind: "valveType",
  speed: "initialSpeed",
  speedPatternId: "speedPattern",
  efficiencyCurveId: "efficiencyCurve",
  energyPricePatternId: "energyPricePattern",
  volumeCurveId: "volumeCurve",
  overflow: "canOverflow",
  junctionConnection: "junction",
  pipeConnection: "pipe",
};

const ASSET_TYPE_KEY_ALIASES: Partial<
  Record<CustomAttributeAssetType, Record<string, string>>
> = {
  pump: { curveId: "libraryCurve" },
  valve: { curveId: "valveCurve" },
};

const translationKeyFor = (
  assetType: CustomAttributeAssetType,
  key: string,
): string =>
  ASSET_TYPE_KEY_ALIASES[assetType]?.[key] ?? PROPERTY_KEY_ALIASES[key] ?? key;

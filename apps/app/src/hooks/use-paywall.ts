import { type DialogState, type PaywallFeature } from "src/state/dialog";
import { type Permissions, usePermissions } from "src/hooks/use-permissions";

type FeatureConfig = {
  permission: keyof Permissions;
  dialog: DialogState;
};

const FEATURE_CONFIG: Record<PaywallFeature, FeatureConfig> = {
  scenarios: {
    permission: "canUseScenarios",
    dialog: { type: "featurePaywall", feature: "scenarios" },
  },
  elevations: {
    permission: "canUseElevations",
    dialog: { type: "featurePaywall", feature: "elevations" },
  },
  customLayers: {
    permission: "canAddCustomLayers",
    dialog: { type: "featurePaywall", feature: "customLayers" },
  },
  pipeAttributes: {
    permission: "canUsePipeAttributes",
    dialog: {
      type: "upgrade",
      source: { kind: "paywall", feature: "pipeAttributes" },
    },
  },
  zones: {
    permission: "canUseZones",
    dialog: { type: "featurePaywall", feature: "zones" },
  },
  pipeLibrary: {
    permission: "canUsePipeLibrary",
    dialog: { type: "featurePaywall", feature: "pipeLibrary" },
  },
  modelAttributesValidation: {
    permission: "canValidateModelAttributes",
    dialog: {
      type: "upgrade",
      source: { kind: "paywall", feature: "modelAttributesValidation" },
    },
  },
};

export const usePaywall = (
  feature: PaywallFeature | undefined,
): DialogState | null => {
  const permissions = usePermissions();
  if (!feature) return null;
  const config = FEATURE_CONFIG[feature];
  return permissions[config.permission] ? null : config.dialog;
};

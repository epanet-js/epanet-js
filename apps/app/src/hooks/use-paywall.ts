import { useCallback } from "react";
import { useSetAtom } from "jotai";
import {
  dialogAtom,
  type DialogState,
  type PaywallFeature,
} from "src/state/dialog";
import { type Permissions, usePermissions } from "src/hooks/use-permissions";
import { useUserTracking } from "src/infra/user-tracking";

type FeatureConfig = {
  permission: keyof Permissions;
  dialog: NonNullable<DialogState>;
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
  refreshElevations: {
    permission: "canRefreshElevations",
    dialog: { type: "upgrade", feature: "refreshElevations" },
  },
  customLayers: {
    permission: "canAddCustomLayers",
    dialog: { type: "featurePaywall", feature: "customLayers" },
  },
  pipeAttributes: {
    permission: "canUsePipeAttributes",
    dialog: { type: "upgrade", feature: "pipeAttributes" },
  },
  zones: {
    permission: "canUseZones",
    dialog: { type: "featurePaywall", feature: "zones" },
  },
  pipeLibrary: {
    permission: "canUsePipeLibrary",
    dialog: { type: "featurePaywall", feature: "pipeLibrary" },
  },
  customAttributes: {
    permission: "canUseCustomAttributes",
    dialog: { type: "featurePaywall", feature: "customAttributes" },
  },
  modelAttributesValidation: {
    permission: "canValidateModelAttributes",
    dialog: { type: "upgrade", feature: "modelAttributesValidation" },
  },
  modelBuilder: {
    permission: "canUseModelBuildV2",
    dialog: { type: "upgrade", feature: "modelBuilder" },
  },
};

// Pure routing: the dialog that starts the upgrade flow for a feature,
// independent of whether the user currently has access.
const upgradeDialogFor = (feature: PaywallFeature): NonNullable<DialogState> =>
  FEATURE_CONFIG[feature].dialog;

export const usePaywall = (
  feature: PaywallFeature | undefined,
): DialogState | null => {
  const permissions = usePermissions();
  if (!feature) return null;
  const config = FEATURE_CONFIG[feature];
  return permissions[config.permission] ? null : config.dialog;
};

// Single entry point to start the upgrade flow for a feature: opens the routed
// dialog and emits paywall.seen when that entry is the upgrade dialog itself.
// featurePaywall screens emit paywall.seen from their own dialog effect instead.
export const useStartUpgrade = () => {
  const setDialog = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  return useCallback(
    (feature: PaywallFeature) => {
      const dialog = upgradeDialogFor(feature);
      if (dialog.type === "upgrade") {
        userTracking.capture({
          name: "paywall.seen",
          feature,
          type: "upgrade",
        });
      }
      setDialog(dialog);
    },
    [setDialog, userTracking],
  );
};

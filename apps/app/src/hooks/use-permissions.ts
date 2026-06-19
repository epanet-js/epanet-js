import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { useAuth } from "src/hooks/use-auth";
import { useOrganization } from "src/hooks/use-organization";
import { useEffectivePlan } from "src/hooks/use-effective-plan";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { Plan, isTrialActive } from "src/lib/account-plans";
import { isDemoNetworkAtom } from "src/state/file-system";

export type Permissions = {
  canAddCustomLayers: boolean;
  canUseScenarios: boolean;
  canUseElevations: boolean;
  canUseHglProfile: boolean;
  canUseCustomGraphs: boolean;
  canUseZones: boolean;
  canUseControls: boolean;
  canUsePipeAttributes: boolean;
  canUseModelBuildV2: boolean;
  canValidateModel: boolean;
  canUpgrade: boolean;
  canManageOrganization: boolean;
};

export const resolvePermissions = (
  plan: Plan,
  trialActive: boolean,
  isOrgAdmin: boolean,
  isDemoNetwork: boolean,
): Permissions => {
  const hasPaidAccess =
    ["pro", "education", "personal", "teams"].includes(plan) || trialActive;
  const hasEarlyAccess =
    ["pro", "personal", "teams"].includes(plan) || trialActive;
  return {
    canAddCustomLayers: hasPaidAccess,
    canUseScenarios: hasPaidAccess,
    canUseElevations: hasPaidAccess,
    canUseHglProfile: hasEarlyAccess,
    canUseCustomGraphs: hasEarlyAccess,
    canUseZones: hasPaidAccess,
    canUseControls: hasPaidAccess,
    canUsePipeAttributes: hasPaidAccess || isDemoNetwork,
    canUseModelBuildV2: ["pro", "teams"].includes(plan) || trialActive,
    canValidateModel: hasPaidAccess,
    canUpgrade: plan === "free",
    canManageOrganization: isOrgAdmin,
  };
};

export const usePermissions = (): Permissions => {
  const { user } = useAuth();
  const effectivePlan = useEffectivePlan();
  const isActivateTrialOn = useFeatureFlag("FLAG_ACTIVATE_TRIAL");
  const trialActive = isActivateTrialOn && isTrialActive(user);
  const org = useOrganization();
  const membership = "membership" in org ? org.membership : null;
  const isOrgAdmin = membership?.role === "org:admin";
  const isDemoNetwork = useAtomValue(isDemoNetworkAtom);
  return useMemo(
    () =>
      resolvePermissions(effectivePlan, trialActive, isOrgAdmin, isDemoNetwork),
    [effectivePlan, trialActive, isOrgAdmin, isDemoNetwork],
  );
};

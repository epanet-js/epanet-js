import { useMemo } from "react";
import { useAuth } from "src/hooks/use-auth";
import { useOrganization } from "src/hooks/use-organization";
import { useEffectivePlan } from "src/hooks/use-effective-plan";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { Plan, isTrialActive } from "src/lib/account-plans";

export type Permissions = {
  canAddCustomLayers: boolean;
  canUseScenarios: boolean;
  canUseElevations: boolean;
  canUpgrade: boolean;
  canManageOrganization: boolean;
};

export const resolvePermissions = (
  plan: Plan,
  trialActive: boolean,
  isOrgAdmin: boolean,
): Permissions => {
  const hasPaidAccess =
    ["pro", "education", "personal", "teams"].includes(plan) || trialActive;
  return {
    canAddCustomLayers: hasPaidAccess,
    canUseScenarios: hasPaidAccess,
    canUseElevations: hasPaidAccess,
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
  return useMemo(
    () => resolvePermissions(effectivePlan, trialActive, isOrgAdmin),
    [effectivePlan, trialActive, isOrgAdmin],
  );
};

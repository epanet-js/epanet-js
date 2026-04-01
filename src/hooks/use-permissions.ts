import { useMemo } from "react";
import { useAuth } from "src/auth";
import { useEffectivePlan } from "src/hooks/use-effective-plan";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { Plan, isTrialActive } from "src/lib/account-plans";

export type Permissions = {
  canAddCustomLayers: boolean;
  canUseScenarios: boolean;
  canUseElevations: boolean;
  canUpgrade: boolean;
};

export const resolvePermissions = (
  plan: Plan,
  trialActive: boolean,
): Permissions => {
  const hasPaidAccess =
    ["pro", "education", "personal", "teams"].includes(plan) || trialActive;
  return {
    canAddCustomLayers: hasPaidAccess,
    canUseScenarios: hasPaidAccess,
    canUseElevations: hasPaidAccess,
    canUpgrade: plan === "free",
  };
};

export const usePermissions = (): Permissions => {
  const { user } = useAuth();
  const effectivePlan = useEffectivePlan();
  const isActivateTrialOn = useFeatureFlag("FLAG_ACTIVATE_TRIAL");
  const trialActive = isActivateTrialOn && isTrialActive(user);
  return useMemo(
    () => resolvePermissions(effectivePlan, trialActive),
    [effectivePlan, trialActive],
  );
};

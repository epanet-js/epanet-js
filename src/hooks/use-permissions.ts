import { useMemo } from "react";
import { useAuth, useOrganization } from "src/auth";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { Plan } from "src/lib/account-plans";

export type Permissions = {
  canAddCustomLayers: boolean;
  canUseScenarios: boolean;
  canUseElevations: boolean;
  canUpgrade: boolean;
};

export const resolvePermissions = (plan: Plan): Permissions => ({
  canAddCustomLayers: ["pro", "education", "personal", "teams"].includes(plan),
  canUseScenarios: ["pro", "education", "personal", "teams"].includes(plan),
  canUseElevations: ["pro", "education", "personal", "teams"].includes(plan),
  canUpgrade: plan === "free",
});

export const useEffectivePlan = (): Plan => {
  const { user } = useAuth();
  const isOrgsOn = useFeatureFlag("FLAG_ORGS");
  const { organization } = useOrganization();
  return isOrgsOn && organization ? "teams" : user.plan;
};

export const usePermissions = (): Permissions => {
  const effectivePlan = useEffectivePlan();
  return useMemo(() => resolvePermissions(effectivePlan), [effectivePlan]);
};

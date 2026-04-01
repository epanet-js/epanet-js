import { useMemo } from "react";
import { useEffectivePlan } from "src/hooks/use-effective-plan";
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

export const usePermissions = (): Permissions => {
  const effectivePlan = useEffectivePlan();
  return useMemo(() => resolvePermissions(effectivePlan), [effectivePlan]);
};

import { useMemo } from "react";
import { useAuth } from "src/auth";
import { Plan } from "src/lib/account-plans";

export type Permissions = {
  canAddCustomLayers: boolean;
  canUseScenarios: boolean;
  canUseElevations: boolean;
  canUpgrade: boolean;
};

export const resolvePermissions = (plan: Plan): Permissions => ({
  canAddCustomLayers: ["pro", "education", "personal"].includes(plan),
  canUseScenarios: ["pro", "education", "personal"].includes(plan),
  canUseElevations: ["pro", "education", "personal"].includes(plan),
  canUpgrade: plan === "free",
});

export const usePermissions = (): Permissions => {
  const { user } = useAuth();
  return useMemo(() => resolvePermissions(user.plan), [user.plan]);
};

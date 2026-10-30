import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { useAuth } from "src/hooks/use-auth";
import { useOrganization } from "src/hooks/use-organization";
import { useEffectivePlan } from "src/hooks/use-effective-plan";
import { Plan, isTrialActive } from "@epanet-js/account-plans";
import { isDemoNetworkAtom } from "src/state/file-system";

export type Permissions = {
  canAddCustomLayers: boolean;
  canUseScenarios: boolean;
  canUseElevations: boolean;
  canRefreshElevations: boolean;
  canUseZones: boolean;
  canUsePipeAttributes: boolean;
  canUseModelBuildV2: boolean;
  canValidateModelAttributes: boolean;
  canUsePipeLibrary: boolean;
  canUseCustomAttributes: boolean;
  canManageCollections: boolean;
  canImportSynergi: boolean;
  canRunScripts: boolean;
  canEditScripts: boolean;
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
  return {
    canAddCustomLayers: hasPaidAccess,
    canUseScenarios: hasPaidAccess || isDemoNetwork,
    canUseElevations: hasPaidAccess,
    canRefreshElevations: hasPaidAccess,
    canUseZones: hasPaidAccess || isDemoNetwork,
    canUsePipeAttributes: hasPaidAccess || isDemoNetwork,
    canUseModelBuildV2:
      ["pro", "teams", "education"].includes(plan) || trialActive,
    canValidateModelAttributes: hasPaidAccess,
    canUsePipeLibrary: hasPaidAccess || isDemoNetwork,
    canUseCustomAttributes: hasPaidAccess || isDemoNetwork,
    canManageCollections: hasPaidAccess || isDemoNetwork,
    canImportSynergi: hasPaidAccess,
    canRunScripts: hasPaidAccess || isDemoNetwork,
    canEditScripts: hasPaidAccess || isDemoNetwork,
    canUpgrade: plan === "free",
    canManageOrganization: isOrgAdmin,
  };
};

export const usePermissions = (): Permissions => {
  const { user } = useAuth();
  const effectivePlan = useEffectivePlan();
  const trialActive = isTrialActive(user);
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

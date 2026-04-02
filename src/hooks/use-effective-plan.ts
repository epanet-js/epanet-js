import { useAuth } from "src/hooks/use-auth";
import { useOrganizationList } from "src/hooks/use-organization-list";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { Plan } from "src/lib/account-plans";

export const useEffectivePlan = (): Plan => {
  const { user } = useAuth();
  const isOrgsOn = useFeatureFlag("FLAG_ORGS");
  const { userMemberships } = useOrganizationList({ userMemberships: true });
  return isOrgsOn && !!userMemberships?.count ? "teams" : user.plan;
};

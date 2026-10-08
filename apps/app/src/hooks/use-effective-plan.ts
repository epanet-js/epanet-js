import { useAuth } from "src/hooks/use-auth";
import { useOrganizationList } from "src/hooks/use-organization-list";
import { Plan } from "@epanet-js/account-plans";

export const useEffectivePlan = (): Plan => {
  const { user } = useAuth();
  const { userMemberships } = useOrganizationList({ userMemberships: true });
  return !!userMemberships?.count ? "teams" : user.plan;
};

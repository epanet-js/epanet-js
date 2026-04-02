import { useOrganizationList as useClerkOrganizationList } from "@clerk/nextjs";
import { isAuthEnabled } from "src/global-config";

export const useOrganizationList = isAuthEnabled
  ? useClerkOrganizationList
  : () => ({ userMemberships: undefined });

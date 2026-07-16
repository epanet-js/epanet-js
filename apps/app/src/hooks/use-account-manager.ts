import { useClerk } from "@clerk/nextjs";
import { isAuthEnabled } from "src/global-config";

export const useAccountManager = isAuthEnabled
  ? useClerk
  : () => ({ openOrganizationProfile: () => {} });

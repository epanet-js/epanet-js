import { useOrganization as useClerkOrganization } from "@clerk/nextjs";
import { isAuthEnabled } from "src/global-config";

export const useOrganization = isAuthEnabled
  ? useClerkOrganization
  : () => ({ organization: null });

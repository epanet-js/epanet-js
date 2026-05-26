import { RedirectToSignIn as ClerkRedirectToSignIn } from "@clerk/nextjs";
import { isAuthEnabled } from "src/global-config";

export const RedirectToSignIn = isAuthEnabled
  ? ClerkRedirectToSignIn
  : () => {
      return null;
    };

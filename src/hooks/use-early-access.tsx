import { useCallback } from "react";
import { useAuth, isAuthEnabled } from "src/auth";
import { signUpUrl } from "src/global-config";

export const useEarlyAccess = () => {
  const { isSignedIn, isLoaded } = useAuth();

  const onlyEarlyAccess = useCallback(
    (callback: () => void) => {
      if (!isLoaded) {
        return;
      }

      if (isSignedIn) {
        callback();
      } else if (isAuthEnabled) {
        window.location.href = signUpUrl;
      }
    },
    [isSignedIn, isLoaded],
  );

  return onlyEarlyAccess;
};

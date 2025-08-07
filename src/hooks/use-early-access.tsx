import { useCallback } from "react";
import { useAuth, isAuthEnabled } from "src/auth";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";

const buildAfterSignupUrl = (dialogType: string) => {
  const pathname = window.location.pathname;
  const query = window.location.search;
  const params = new URLSearchParams(query);
  params.set("dialog", dialogType);
  // Build an absolute URL for redirect
  const origin = window.location.origin;
  return `${origin}${pathname}?${params.toString()}`;
};

export const useEarlyAccess = () => {
  const { isSignedIn, isLoaded } = useAuth();
  const setDialogState = useSetAtom(dialogAtom);

  const onlyEarlyAccess = useCallback(
    (callback: () => void, afterSignupDialog?: string) => {
      if (!isLoaded) {
        return;
      }

      if (isSignedIn) {
        callback();
      } else if (isAuthEnabled) {
        setDialogState({
          type: "earlyAccess",
          onContinue: callback,
          afterSignupDialog,
        });
      }
    },
    [isSignedIn, isLoaded, setDialogState],
  );

  return onlyEarlyAccess;
};

export { buildAfterSignupUrl };

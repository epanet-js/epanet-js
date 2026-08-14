import { useEffect, useRef } from "react";
import { useAuth } from "src/hooks/use-auth";
import { subscribeToUserChanged } from "src/infra/auth-sync";
import { captureError } from "src/infra/error-tracking";

export const AuthSyncGuard = () => {
  const { reload } = useAuth();
  const reloadRef = useRef(reload);

  reloadRef.current = reload;

  useEffect(() => {
    return subscribeToUserChanged(() => {
      void reloadRef.current().catch((error) => captureError(error as Error));
    });
  }, []);

  return null;
};

import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { useSearchParams } from "next/navigation";
import { recoverableSessionsAtom } from "src/state/session-recovery";
import { useAuth } from "src/hooks/use-auth";
import { useOpenModelBuilder } from "src/commands/open-model-builder";

const viewParam = "view";
const modelBuildViewValue = "modelBuild";

const removeViewParam = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete(viewParam);
  window.history.replaceState({}, "", url);
};

export const ModelBuildViewUrl = () => {
  const { isLoaded } = useAuth();
  const openModelBuilder = useOpenModelBuilder();
  const hasRecoverableSession =
    useAtomValue(recoverableSessionsAtom).length > 0;
  const isRequestedByUrl =
    useSearchParams().get(viewParam) === modelBuildViewValue;
  const hasPendingRequest = useRef(false);

  useEffect(() => {
    if (isRequestedByUrl) {
      hasPendingRequest.current = true;
      removeViewParam();
    }

    if (!hasPendingRequest.current || !isLoaded) return;
    hasPendingRequest.current = false;
    if (hasRecoverableSession) return;
    openModelBuilder({ source: "url" });
  }, [isRequestedByUrl, isLoaded, hasRecoverableSession, openModelBuilder]);

  return null;
};

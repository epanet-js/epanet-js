import { usePostHog } from "posthog-js/react";

export const useFeatureFlag = (name: string): boolean => {
  const posthog = usePostHog();

  if (posthog?.isFeatureEnabled) {
    const posthogFlag = posthog.isFeatureEnabled(name);
    if (posthogFlag !== undefined) {
      return posthogFlag;
    }
  }

  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get(name);
    if (flag) {
      return flag === "true";
    }
  }

  return false;
};

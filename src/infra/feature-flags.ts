import { PostHog } from "posthog-js";

let posthogInstance: PostHog | null = null;

export const setPostHogInstance = (instance: PostHog) => {
  posthogInstance = instance;
};

export const checkFeatureFlag = (
  name: string,
  posthog: PostHog | null = posthogInstance,
): boolean => {
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

export const isFeatureOn = (name: string): boolean => {
  return checkFeatureFlag(name);
};

import { usePostHog } from "posthog-js/react";
import { checkFeatureFlag } from "src/infra/feature-flags";

export const useFeatureFlag = (name: string): boolean => {
  const posthog = usePostHog();
  return checkFeatureFlag(name, posthog);
};

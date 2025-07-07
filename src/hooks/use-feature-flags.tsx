import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";
import { setFlagsContext } from "src/infra/error-tracking";
import { isPosthogConfigured } from "src/infra/user-tracking";

const FeatureFlagsPostHogProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const posthog = usePostHog();
  const [flagsVersion, setFlagsVersion] = useState(0);

  useEffect(() => {
    if (posthog) {
      posthog.onFeatureFlags((flagsEnabled) => {
        setFlagsContext(flagsEnabled);
        setFlagsVersion((prev) => prev + 1);
      });
    }
  }, [posthog]);

  return <div key={`flags-${flagsVersion}`}>{children}</div>;
};

const FeatureFlagsUrlProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  useEffect(() => {
    const flagsEnabled = getEnabledFlagsFromUrl();
    setFlagsContext(flagsEnabled);
  }, []);

  return children as JSX.Element;
};

export const FeatureFlagsProvider = isPosthogConfigured
  ? FeatureFlagsPostHogProvider
  : FeatureFlagsUrlProvider;

const useFeatureFlagWithPostHog = (name: string): boolean => {
  const posthog = usePostHog();

  if (posthog?.isFeatureEnabled) {
    const posthogFlag = posthog.isFeatureEnabled(name);
    if (posthogFlag !== undefined) {
      return posthogFlag;
    }
  }

  return false;
};

const useFeatureFlagWithUrl = (name: string): boolean => {
  const flagsFromUrl = getEnabledFlagsFromUrl();
  return flagsFromUrl.includes(name);
};

export const useFeatureFlag = isPosthogConfigured
  ? useFeatureFlagWithPostHog
  : useFeatureFlagWithUrl;

const getEnabledFlagsFromUrl = (): string[] => {
  if (typeof window === "undefined" || typeof window.location === "undefined") {
    return [];
  }

  const urlParams = new URLSearchParams(window.location.search);
  const enabledFlags: string[] = [];

  for (const [key, value] of urlParams.entries()) {
    if (key.startsWith("FLAG_")) {
      if (value.toLowerCase() === "true") {
        enabledFlags.push(key);
      }
    }
  }

  return enabledFlags;
};

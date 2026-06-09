import { usePostHog } from "posthog-js/react";
import { useEffect, useState, createContext, useContext, useRef } from "react";
import { setFlagsContext } from "src/infra/error-tracking";
import { isPosthogConfigured } from "src/infra/user-tracking";
import {
  getDisabledFlagsFromUrl,
  getEnabledFlagsFromUrl,
  getFlagOverrideFromUrl,
  useUrlFeatureFlag as useUrlFeatureFlagImpl,
} from "./use-url-feature-flag";

const FEATURE_FLAGS_TIMEOUT_MS = 5000;

type FeatureFlagsState = {
  isReady: boolean;
  enabledFlags: string[];
};

const FeatureFlagsContext = createContext<FeatureFlagsState>({
  isReady: false,
  enabledFlags: [],
});

const FeatureFlagsPostHogProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const posthog = usePostHog();
  const [flagsVersion, setFlagsVersion] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [enabledFlags, setEnabledFlags] = useState<string[]>([]);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (posthog && !hasInitializedRef.current) {
      hasInitializedRef.current = true;

      const featureFlagsPromise = new Promise<string[]>((resolve) => {
        posthog.onFeatureFlags((flagsEnabled) => {
          resolve(flagsEnabled);
        });
      });

      const timeoutPromise = new Promise<string[]>((resolve) => {
        setTimeout(() => resolve([]), FEATURE_FLAGS_TIMEOUT_MS);
      });

      Promise.race([featureFlagsPromise, timeoutPromise])
        .then((flagsEnabled) => {
          setFlagsContext(flagsEnabled);
          setEnabledFlags(flagsEnabled);
          setFlagsVersion((prev) => prev + 1);
          setIsReady(true);
        })
        .catch(() => {
          setFlagsContext([]);
          setIsReady(true);
        });
    }
  }, [posthog, isReady]);

  return (
    <FeatureFlagsContext.Provider value={{ isReady, enabledFlags }}>
      <div key={`flags-${flagsVersion}`}>{children}</div>
    </FeatureFlagsContext.Provider>
  );
};

const FeatureFlagsUrlProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isReady, setIsReady] = useState(false);
  const [enabledFlags, setEnabledFlags] = useState<string[]>([]);

  useEffect(() => {
    const flagsEnabled = getEnabledFlagsFromUrl();
    setFlagsContext(flagsEnabled);
    setEnabledFlags(flagsEnabled);
    setIsReady(true);
  }, []);

  return (
    <FeatureFlagsContext.Provider value={{ isReady, enabledFlags }}>
      {children as JSX.Element}
    </FeatureFlagsContext.Provider>
  );
};

export const FeatureFlagsProvider = isPosthogConfigured
  ? FeatureFlagsPostHogProvider
  : FeatureFlagsUrlProvider;

const useFeatureFlagWithPostHog = (name: string): boolean => {
  const posthog = usePostHog();

  const urlOverride = getFlagOverrideFromUrl(name);
  if (urlOverride !== undefined) return urlOverride;

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

export const useFeatureFlagsReady = (): boolean => {
  return useContext(FeatureFlagsContext).isReady;
};

export const useEnabledFeatureFlags = (): string[] => {
  const { enabledFlags } = useContext(FeatureFlagsContext);

  const urlEnabled = getEnabledFlagsFromUrl();
  const urlDisabled = getDisabledFlagsFromUrl();

  const merged = new Set([...enabledFlags, ...urlEnabled]);
  for (const flag of urlDisabled) merged.delete(flag);

  return Array.from(merged);
};

/**
 * Hook that ONLY checks URL parameters for feature flags.
 * Useful for testing features independently of PostHog state.
 * Always returns the URL parameter value, ignoring PostHog configuration.
 *
 * Re-exported from use-url-feature-flag.ts for backwards compatibility.
 */
export const useUrlFeatureFlag = useUrlFeatureFlagImpl;

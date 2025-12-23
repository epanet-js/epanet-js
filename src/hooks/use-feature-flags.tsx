import { usePostHog } from "posthog-js/react";
import { useEffect, useState, createContext, useContext, useRef } from "react";
import { setFlagsContext } from "src/infra/error-tracking";
import { isPosthogConfigured } from "src/infra/user-tracking";
import {
  getEnabledFlagsFromUrl,
  useUrlFeatureFlag as useUrlFeatureFlagImpl,
} from "./use-url-feature-flag";

const FEATURE_FLAGS_TIMEOUT_MS = 5000;

const FeatureFlagsReadyContext = createContext<boolean>(false);

const FeatureFlagsPostHogProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const posthog = usePostHog();
  const [flagsVersion, setFlagsVersion] = useState(0);
  const [isReady, setIsReady] = useState(false);
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
    <FeatureFlagsReadyContext.Provider value={isReady}>
      <div key={`flags-${flagsVersion}`}>{children}</div>
    </FeatureFlagsReadyContext.Provider>
  );
};

const FeatureFlagsUrlProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const flagsEnabled = getEnabledFlagsFromUrl();
    setFlagsContext(flagsEnabled);
    setIsReady(true);
  }, []);

  return (
    <FeatureFlagsReadyContext.Provider value={isReady}>
      {children as JSX.Element}
    </FeatureFlagsReadyContext.Provider>
  );
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

export const useFeatureFlagsReady = (): boolean => {
  return useContext(FeatureFlagsReadyContext);
};

/**
 * Hook that ONLY checks URL parameters for feature flags.
 * Useful for testing features independently of PostHog state.
 * Always returns the URL parameter value, ignoring PostHog configuration.
 *
 * Re-exported from use-url-feature-flag.ts for backwards compatibility.
 */
export const useUrlFeatureFlag = useUrlFeatureFlagImpl;

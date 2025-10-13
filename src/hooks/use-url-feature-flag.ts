/**
 * URL-based feature flag utilities.
 * Extracted to avoid circular dependencies with use-feature-flags.tsx
 */

/**
 * Extracts enabled feature flags from URL parameters.
 * Looks for parameters starting with "FLAG_" and value "true".
 */
export const getEnabledFlagsFromUrl = (): string[] => {
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

/**
 * Hook that ONLY checks URL parameters for feature flags.
 * Useful for testing features independently of PostHog state.
 * Always returns the URL parameter value, ignoring PostHog configuration.
 */
export const useUrlFeatureFlag = (name: string): boolean => {
  const flagsFromUrl = getEnabledFlagsFromUrl();
  return flagsFromUrl.includes(name);
};

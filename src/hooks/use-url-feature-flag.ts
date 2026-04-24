/**
 * URL-based feature flag utilities.
 * Extracted to avoid circular dependencies with use-feature-flags.tsx
 */

/**
 * Extracts enabled feature flags from URL parameters.
 * Looks for parameters starting with "FLAG_" and value "true".
 */
const parseFlagsFromUrl = (): Record<string, boolean> => {
  if (process.env.NODE_ENV === "production") return {};
  if (typeof window === "undefined" || typeof window.location === "undefined") {
    return {};
  }

  const urlParams = new URLSearchParams(window.location.search);
  const flags: Record<string, boolean> = {};

  for (const [key, value] of urlParams.entries()) {
    if (key.startsWith("FLAG_")) {
      const lower = value.toLowerCase();
      if (lower === "true") flags[key] = true;
      else if (lower === "false") flags[key] = false;
    }
  }

  return flags;
};

export const getEnabledFlagsFromUrl = (): string[] =>
  Object.entries(parseFlagsFromUrl())
    .filter(([, v]) => v)
    .map(([k]) => k);

/** Returns true/false if the URL explicitly sets the flag, undefined if absent. */
export const getFlagOverrideFromUrl = (name: string): boolean | undefined =>
  parseFlagsFromUrl()[name];

/**
 * Hook that ONLY checks URL parameters for feature flags.
 * Useful for testing features independently of PostHog state.
 * Always returns the URL parameter value, ignoring PostHog configuration.
 */
export const useUrlFeatureFlag = (name: string): boolean => {
  const flagsFromUrl = getEnabledFlagsFromUrl();
  return flagsFromUrl.includes(name);
};

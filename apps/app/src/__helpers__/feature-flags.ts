import { Mock, vi } from "vitest";

import * as useFeatureFlags from "src/hooks/use-feature-flags";

vi.mock("src/hooks/use-feature-flags", () => ({
  useFeatureFlag: vi.fn(),
  useFeatureFlagsReady: vi.fn(() => true),
  useEnabledFeatureFlags: vi.fn(() => []),
}));

const stubEnabled = (names: string[]) => {
  const enabled = new Set(names);
  (useFeatureFlags.useFeatureFlag as Mock).mockImplementation((flag: string) =>
    enabled.has(flag),
  );
  (useFeatureFlags.useEnabledFeatureFlags as Mock).mockImplementation(() => [
    ...names,
  ]);
};

export const stubFeatureOn = (name: string) => {
  stubEnabled([name]);
};

export const stubFeaturesOn = (names: string[]) => {
  stubEnabled(names);
};

export const stubFeatureOff = (_name: string) => {
  stubEnabled([]);
};

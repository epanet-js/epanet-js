import { Mock, vi } from "vitest";

import * as useFeatureFlags from "src/hooks/use-feature-flags";

vi.mock("src/hooks/use-feature-flags", () => ({
  useFeatureFlag: vi.fn(),
  useFeatureFlagsReady: vi.fn(() => true),
}));

export const stubFeatureOn = (name: string) => {
  const mockImpl = (flag: string) => {
    if (flag === name) return true;
    return false;
  };
  (useFeatureFlags.useFeatureFlag as Mock).mockImplementation(mockImpl);
};

export const stubFeatureOff = (name: string) => {
  const mockImpl = (flag: string) => {
    if (flag === name) return false;
    return false;
  };
  (useFeatureFlags.useFeatureFlag as Mock).mockImplementation(mockImpl);
};

import { Mock, vi } from "vitest";

import * as useFeatureFlags from "src/hooks/use-feature-flags";

vi.mock("src/hooks/use-feature-flags", () => ({
  useFeatureFlag: vi.fn((flag: string) =>
    flag === "FLAG_STATE_REFACTOR" ? true : false,
  ),
  useFeatureFlagsReady: vi.fn(() => true),
}));

export const stubFeatureOn = (name: string) => {
  const mockImpl = (flag: string) => {
    if (flag === name) return true;
    if (flag === "FLAG_STATE_REFACTOR") return true;
    return false;
  };
  (useFeatureFlags.useFeatureFlag as Mock).mockImplementation(mockImpl);
};

export const stubFeatureOff = (name: string) => {
  const mockImpl = (flag: string) => {
    if (flag === name) return false;
    if (flag === "FLAG_STATE_REFACTOR") return true;
    return false;
  };
  (useFeatureFlags.useFeatureFlag as Mock).mockImplementation(mockImpl);
};

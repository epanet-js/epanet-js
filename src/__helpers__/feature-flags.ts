import { Mock, vi } from "vitest";

import * as featureFlags from "src/infra/feature-flags";

vi.mock("src/infra/feature-flags", () => ({
  isFeatureOn: vi.fn(),
}));

export const stubFeatureOn = (name: string) => {
  (featureFlags.isFeatureOn as Mock).mockImplementation((flag: string) => {
    if (flag === name) return true;
  });
};

import { vi } from "vitest";
import * as userTrackingModule from "src/infra/user-tracking";

vi.mock("src/infra/user-tracking", () => ({
  useUserTracking: vi.fn(),
}));

export const stubUserTracking = () => {
  const mockTracking = {
    capture: vi.fn(),
    identify: vi.fn(),
    isIdentified: vi.fn(),
    reset: vi.fn(),
  };
  vi.mocked(userTrackingModule.useUserTracking).mockReturnValue(mockTracking);
  return mockTracking;
};

import { describe, it, expect, vi, afterEach } from "vitest";
import { getTrialDaysRemaining } from "./user-plan";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const now = new Date("2025-06-15T12:00:00Z");

describe("getTrialDaysRemaining", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const remaining = (trialEndsAt: string) => {
    vi.useFakeTimers({ now });
    return getTrialDaysRemaining(trialEndsAt);
  };

  it("returns 0 when a few hours remain", () => {
    const endsAt = new Date(now.getTime() + 2 * MS_PER_HOUR).toISOString();
    expect(remaining(endsAt)).toBe(0);
  });

  it("returns 0 when less than a day remains", () => {
    const endsAt = new Date(now.getTime() + 23 * MS_PER_HOUR).toISOString();
    expect(remaining(endsAt)).toBe(0);
  });

  it("returns 1 when exactly 1 day remains", () => {
    const endsAt = new Date(now.getTime() + MS_PER_DAY).toISOString();
    expect(remaining(endsAt)).toBe(1);
  });

  it("returns 1 when between 1 and 2 days remain", () => {
    const endsAt = new Date(
      now.getTime() + MS_PER_DAY + 12 * MS_PER_HOUR,
    ).toISOString();
    expect(remaining(endsAt)).toBe(1);
  });

  it("returns 13 when 13 full days remain", () => {
    const endsAt = new Date(now.getTime() + 13 * MS_PER_DAY).toISOString();
    expect(remaining(endsAt)).toBe(13);
  });

  it("returns negative when trial has expired", () => {
    const endsAt = new Date(now.getTime() - 2 * MS_PER_DAY).toISOString();
    expect(remaining(endsAt)).toBeLessThan(0);
  });
});

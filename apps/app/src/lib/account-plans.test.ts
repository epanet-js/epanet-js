import { describe, it, expect, vi, afterEach } from "vitest";
import {
  Plan,
  SubscriptionStatus,
  getTrialDaysRemaining,
  hasBillingAccount,
  isTrialActive,
  resolveTrialCta,
} from "./account-plans";

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

  it("returns 2 when between 1 and 2 days remain", () => {
    const endsAt = new Date(
      now.getTime() + MS_PER_DAY + 12 * MS_PER_HOUR,
    ).toISOString();
    expect(remaining(endsAt)).toBe(2);
  });

  it("returns 13 when 13 full days remain", () => {
    const endsAt = new Date(now.getTime() + 13 * MS_PER_DAY).toISOString();
    expect(remaining(endsAt)).toBe(13);
  });

  it("returns 14 when just under 14 days remain", () => {
    const endsAt = new Date(
      now.getTime() + 14 * MS_PER_DAY - MS_PER_HOUR,
    ).toISOString();
    expect(remaining(endsAt)).toBe(14);
  });

  it("returns negative when trial has expired", () => {
    const endsAt = new Date(now.getTime() - 2 * MS_PER_DAY).toISOString();
    expect(remaining(endsAt)).toBeLessThan(0);
  });
});

describe("isTrialActive", () => {
  const inTwoWeeks = new Date(Date.now() + 14 * MS_PER_DAY).toISOString();

  const user = (attributes: Partial<Parameters<typeof isTrialActive>[0]>) => ({
    hasUsedTrial: true,
    trialEndsAt: inTwoWeeks,
    subscriptionStatus: null,
    ...attributes,
  });

  it("follows stripe rather than the clock once a status is known", () => {
    expect(isTrialActive(user({ subscriptionStatus: "trialing" }))).toBe(true);
    expect(isTrialActive(user({ subscriptionStatus: "paused" }))).toBe(false);
    expect(isTrialActive(user({ subscriptionStatus: "canceled" }))).toBe(false);
    expect(isTrialActive(user({ subscriptionStatus: "active" }))).toBe(false);
  });

  it("ends access on a cancellation even while the end date is in the future", () => {
    expect(
      isTrialActive(
        user({ subscriptionStatus: "canceled", trialEndsAt: inTwoWeeks }),
      ),
    ).toBe(false);
  });

  it("falls back to the end date for a trial started before the sync existed", () => {
    expect(isTrialActive(user({}))).toBe(true);

    const past = new Date(Date.now() - MS_PER_DAY).toISOString();
    expect(isTrialActive(user({ trialEndsAt: past }))).toBe(false);
  });

  it("is false without a trial", () => {
    expect(isTrialActive(user({ hasUsedTrial: false }))).toBe(false);
    expect(isTrialActive(user({ trialEndsAt: null }))).toBe(false);
  });
});

describe("resolveTrialCta", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const user = (
    attributes: Partial<Parameters<typeof resolveTrialCta>[0]>,
  ) => ({
    hasUsedTrial: true,
    trialEndsAt: new Date(now.getTime() + 9 * MS_PER_DAY).toISOString(),
    subscriptionStatus: "trialing" as SubscriptionStatus | null,
    ...attributes,
  });

  const resolve = (
    attributes: Partial<Parameters<typeof resolveTrialCta>[0]>,
  ) => {
    vi.useFakeTimers({ now });
    return resolveTrialCta(user(attributes));
  };

  it("counts down while the trial runs", () => {
    expect(resolve({})).toEqual({ kind: "running", daysRemaining: 9 });
  });

  it("never counts below zero when the end date has passed", () => {
    const yesterday = new Date(now.getTime() - MS_PER_DAY).toISOString();

    expect(resolve({ trialEndsAt: yesterday })).toEqual({
      kind: "running",
      daysRemaining: 0,
    });
  });

  it("asks a paused trial to pay", () => {
    expect(resolve({ subscriptionStatus: "paused" })).toEqual({
      kind: "ended",
      payable: true,
    });
  });

  it("asks a failing card to pay", () => {
    expect(resolve({ subscriptionStatus: "past_due" })).toEqual({
      kind: "ended",
      payable: true,
    });
  });

  it("says nothing once the subscription is cancelled", () => {
    expect(resolve({ subscriptionStatus: "canceled" })).toEqual({
      kind: "none",
    });
  });

  it("says nothing to a cancelled subscription whose trial dates have passed", () => {
    const yesterday = new Date(now.getTime() - MS_PER_DAY).toISOString();

    expect(
      resolve({ subscriptionStatus: "canceled", trialEndsAt: yesterday }),
    ).toEqual({ kind: "none" });
  });

  it("says the trial ended for a trial predating the stripe sync", () => {
    const yesterday = new Date(now.getTime() - MS_PER_DAY).toISOString();

    expect(
      resolve({ subscriptionStatus: null, trialEndsAt: yesterday }),
    ).toEqual({ kind: "ended", payable: false });
  });

  it("keeps counting down a legacy trial that is still running", () => {
    expect(resolve({ subscriptionStatus: null })).toEqual({
      kind: "running",
      daysRemaining: 9,
    });
  });

  it("says nothing while a converted trial waits for its plan", () => {
    expect(resolve({ subscriptionStatus: "active" })).toEqual({ kind: "none" });
  });

  it("says nothing to someone who never trialled", () => {
    expect(resolve({ hasUsedTrial: false })).toEqual({ kind: "none" });
  });
});

describe("hasBillingAccount", () => {
  const user = (plan: Plan, hasUsedTrial = false) => ({ plan, hasUsedTrial });

  it("has one once a plan has been purchased", () => {
    expect(hasBillingAccount(user("pro"))).toBe(true);
    expect(hasBillingAccount(user("personal"))).toBe(true);
  });

  it("has one once the trial has started, even after it ended", () => {
    expect(hasBillingAccount(user("free", true))).toBe(true);
  });

  it("has none for a free user who never trialled", () => {
    expect(hasBillingAccount(user("free"))).toBe(false);
  });

  it("has none for plans granted outside stripe", () => {
    expect(hasBillingAccount(user("education"))).toBe(false);
    expect(hasBillingAccount(user("teams"))).toBe(false);
  });
});

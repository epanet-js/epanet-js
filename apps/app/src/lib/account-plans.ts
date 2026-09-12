export type Plan = "free" | "pro" | "personal" | "education" | "teams";

export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "paused";

export const isTrialActive = (user: {
  hasUsedTrial: boolean;
  trialEndsAt: string | null;
  subscriptionStatus: SubscriptionStatus | null;
}) => {
  if (!user.hasUsedTrial || !user.trialEndsAt) return false;
  if (user.subscriptionStatus) return user.subscriptionStatus === "trialing";

  return new Date(user.trialEndsAt) > new Date();
};

const purchasablePlans: Plan[] = ["pro", "personal"];

export const hasBillingAccount = (user: {
  plan: Plan;
  hasUsedTrial: boolean;
}): boolean => purchasablePlans.includes(user.plan) || user.hasUsedTrial;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const getTrialDaysRemaining = (trialEndsAt: string): number => {
  const diff = new Date(trialEndsAt).getTime() - new Date().getTime();
  if (diff <= 0) return Math.floor(diff / MS_PER_DAY);
  if (diff < MS_PER_DAY) return 0;
  return Math.ceil(diff / MS_PER_DAY);
};

export type TrialCta =
  | { kind: "running"; daysRemaining: number }
  | { kind: "ended"; payable: boolean }
  | { kind: "none" };

const payableAfterTrial: SubscriptionStatus[] = ["paused", "past_due"];

export const resolveTrialCta = (user: {
  hasUsedTrial: boolean;
  trialEndsAt: string | null;
  subscriptionStatus: SubscriptionStatus | null;
}): TrialCta => {
  if (!user.hasUsedTrial) return { kind: "none" };

  if (isTrialActive(user)) {
    if (!user.trialEndsAt) return { kind: "none" };

    return {
      kind: "running",
      daysRemaining: Math.max(0, getTrialDaysRemaining(user.trialEndsAt)),
    };
  }

  if (
    user.subscriptionStatus === "active" ||
    user.subscriptionStatus === "canceled"
  )
    return { kind: "none" };

  return {
    kind: "ended",
    payable:
      user.subscriptionStatus !== null &&
      payableAfterTrial.includes(user.subscriptionStatus),
  };
};

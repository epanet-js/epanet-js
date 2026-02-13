export type Plan = "free" | "pro" | "personal" | "education";

export const isTrialActive = (user: {
  hasUsedTrial: boolean;
  trialEndsAt: string | null;
}) => {
  if (!user.hasUsedTrial || !user.trialEndsAt) return false;
  return new Date(user.trialEndsAt) > new Date();
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const getTrialDaysRemaining = (trialEndsAt: string): number => {
  const diff = new Date(trialEndsAt).getTime() - new Date().getTime();
  if (diff <= 0) return Math.floor(diff / MS_PER_DAY);
  if (diff < MS_PER_DAY) return 0;
  return Math.ceil(diff / MS_PER_DAY);
};

export const canUpgrade = (plan: Plan) => {
  return plan === "free";
};

export const limits = {
  canAddCustomLayers: (plan: Plan) => {
    return ["pro", "education", "personal"].includes(plan);
  },
  canUseScenarios: (plan: Plan) => {
    return ["pro", "education", "personal"].includes(plan);
  },
};

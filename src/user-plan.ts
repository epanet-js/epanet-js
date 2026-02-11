export type Plan = "free" | "pro" | "personal" | "education";

export const isTrialActive = (user: { trialEndsAt: string | null }) => {
  if (!user.trialEndsAt) return false;
  return new Date(user.trialEndsAt) > new Date();
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

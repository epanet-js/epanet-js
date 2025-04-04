export type Plan = "free" | "pro" | "personal" | "education";

export const canUpgrade = (plan: Plan) => {
  return plan === "free";
};

export const limits = {
  canAddCustomLayers: (plan: Plan) => {
    return ["pro", "education", "personal"].includes(plan);
  },
};

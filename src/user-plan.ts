import { Plan, User } from "./auth-types";

export const canUpgrade = (user: User) => {
  return user.plan === "free";
};

export const limits = {
  canAddCustomLayers: (plan: Plan) => {
    return ["pro", "education", "personal"].includes(plan);
  },
};

import { User } from "./auth";

export const canUpgrade = (user: User) => {
  return user.plan === "free";
};

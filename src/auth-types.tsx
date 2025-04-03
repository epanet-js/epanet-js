export type Plan = "free" | "pro" | "personal" | "education";

export type User = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  plan: Plan;
};

export const nullUser: User = {
  id: "",
  email: "",
  firstName: undefined,
  lastName: undefined,
  plan: "free",
};

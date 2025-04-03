export type Plan = "free" | "pro" | "personal" | "education";

export type User = {
  id: string | null;
  email: string;
  firstName?: string;
  lastName?: string;
  plan: Plan;
};

export const nullUser: User = {
  id: null,
  email: "",
  firstName: undefined,
  lastName: undefined,
  plan: "free",
};

export type UseAuthHook = () => {
  isSignedIn?: boolean;
  userId: string | null | undefined;
  user: User;
};

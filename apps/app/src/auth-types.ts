import { Plan, SubscriptionStatus } from "src/lib/account-plans";
import { Locale } from "@epanet-js/i18n/locale";

export type User = {
  id: string | null;
  email: string;
  firstName?: string;
  lastName?: string;
  plan: Plan;
  trialActivatedAt: string | null;
  trialEndsAt: string | null;
  hasUsedTrial: boolean;
  subscriptionStatus: SubscriptionStatus | null;
  getLocale?: () => Locale | undefined;
  setLocale?: (locale: Locale) => Promise<void>;
};

export const nullUser: User = {
  id: null,
  email: "",
  firstName: undefined,
  lastName: undefined,
  plan: "free",
  trialActivatedAt: null,
  trialEndsAt: null,
  hasUsedTrial: false,
  subscriptionStatus: null,
  getLocale: undefined,
  setLocale: undefined,
};

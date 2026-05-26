import { Plan } from "src/lib/account-plans";
import { Locale } from "./infra/i18n/locale";

export type User = {
  id: string | null;
  email: string;
  firstName?: string;
  lastName?: string;
  plan: Plan;
  trialActivatedAt: string | null;
  trialEndsAt: string | null;
  hasUsedTrial: boolean;
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
  getLocale: undefined,
  setLocale: undefined,
};

import type { Locale } from "@epanet-js/i18n/locale";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useLocale } from "src/hooks/use-locale";
import { Plan } from "src/lib/account-plans";
import { billingUrl } from "src/global-config";

export type PaymentType = "monthly" | "yearly";

export const useCheckout = () => {
  const { locale } = useLocale();
  const setDialogState = useSetAtom(dialogAtom);

  const startCheckout = (plan: Plan, paymentType: PaymentType) => {
    window.open(
      buildBillingCheckoutUrl(plan, paymentType, locale),
      "_blank",
      "noopener,noreferrer",
    );
    setDialogState({ type: "waitingForPayment" });
  };

  return { startCheckout };
};

export const buildBillingCheckoutUrl = (
  plan: Plan,
  paymentType: PaymentType,
  locale: Locale,
) => {
  const url = new URL("/checkout", billingUrl);
  url.searchParams.set("plan", plan);
  url.searchParams.set("paymentType", paymentType);
  url.searchParams.set("locale", locale);
  return url.toString();
};

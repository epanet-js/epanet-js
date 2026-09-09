import type { Locale } from "@epanet-js/i18n/locale";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useAuth } from "src/hooks/use-auth";
import { useLocale } from "src/hooks/use-locale";
import { billingUrl } from "src/global-config";

export const useBillingPortal = () => {
  const { locale } = useLocale();
  const { user } = useAuth();
  const setDialogState = useSetAtom(dialogAtom);

  const openBillingPortal = () => {
    window.open(buildBillingPortalUrl(locale), "_blank", "noopener,noreferrer");
    if (user.plan === "free") setDialogState({ type: "waitingForPayment" });
  };

  return { openBillingPortal };
};

export const buildBillingPortalUrl = (locale: Locale) => {
  const url = new URL("/portal", billingUrl);
  url.searchParams.set("locale", locale);
  return url.toString();
};

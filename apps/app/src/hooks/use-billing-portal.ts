import type { Locale } from "@epanet-js/i18n/locale";
import { useLocale } from "src/hooks/use-locale";
import { billingUrl } from "src/global-config";

export const useBillingPortal = () => {
  const { locale } = useLocale();

  const openBillingPortal = () => {
    window.open(buildBillingPortalUrl(locale), "_blank", "noopener,noreferrer");
  };

  return { openBillingPortal };
};

export const buildBillingPortalUrl = (locale: Locale) => {
  const url = new URL("/portal", billingUrl);
  url.searchParams.set("locale", locale);
  return url.toString();
};

import { loadStripe } from "@stripe/stripe-js";
import { atom, useAtom } from "jotai";
import { notify } from "src/components/notifications";
import { captureError } from "src/infra/error-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { Plan } from "src/lib/account-plans";
import { ErrorIcon } from "src/icons";
import { billingUrl } from "src/global-config";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

// Loaded lazily on first checkout so js.stripe.com is not fetched on every page
// load (it injects its script as a side effect).
let stripeSDK: ReturnType<typeof loadStripe> | undefined;
const getStripe = () =>
  (stripeSDK ??= loadStripe(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
  ));

export type PaymentType = "monthly" | "yearly";

const checkoutLoadingAtom = atom<boolean>(false);

export const useCheckout = () => {
  const isBillingOn = useFeatureFlag("FLAG_BILLING");
  const translate = useTranslate();
  const [isLoading, setLoading] = useAtom(checkoutLoadingAtom);

  const startCheckoutDeprecated = async (
    plan: Plan,
    paymentType: PaymentType,
  ) => {
    clearCheckoutParams();

    setLoading(true);
    try {
      await startCheckout(plan, paymentType);
    } catch (error) {
      setLoading(false);
      captureError(error as Error);
      notify({
        variant: "error",
        title: translate("somethingWentWrong"),
        description: translate("tryAgainOrSupport"),
        Icon: ErrorIcon,
      });
    }
  };

  const startCheckoutInBillingApp = (plan: Plan, paymentType: PaymentType) => {
    clearCheckoutParams();

    setLoading(true);
    window.location.assign(buildBillingCheckoutUrl(plan, paymentType));
  };

  return {
    startCheckout: isBillingOn
      ? startCheckoutInBillingApp
      : startCheckoutDeprecated,
    isLoading,
  };
};

export const startCheckout = async (plan: Plan, paymentType: PaymentType) => {
  const stripe = await getStripe();
  const response = await fetch("/api/stripe-checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ plan, paymentType }),
  });
  const { sessionId } = await response.json();

  await stripe?.redirectToCheckout({ sessionId });
};

export const getCheckoutUrlParams = () => {
  const query = window.location.search;
  const params = new URLSearchParams(query);
  return {
    enabled: params.get("startCheckout") === "true",
    plan: params.get("plan") as Plan,
    paymentType: params.get("paymentType") as PaymentType,
  };
};

export const clearCheckoutParams = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete("startCheckout");

  window.history.replaceState({}, "", url);
};

export const buildBillingCheckoutUrl = (
  plan: Plan,
  paymentType: PaymentType,
) => {
  const url = new URL("/checkout", billingUrl);
  url.searchParams.set("plan", plan);
  url.searchParams.set("paymentType", paymentType);
  url.searchParams.set(
    "successUrl",
    `${window.location.origin}/?notification=checkoutSuccess`,
  );
  url.searchParams.set(
    "cancelUrl",
    `${window.location.origin}/?dialog=upgrade`,
  );
  return url.toString();
};

export const buildCheckoutUrl = (plan: Plan, paymentType: PaymentType) => {
  const pathname = window.location.pathname;
  const query = window.location.search;
  const params = new URLSearchParams(query);
  params.set("dialog", "upgrade");
  params.set("startCheckout", "true");
  params.set("plan", plan);
  params.set("paymentType", paymentType);
  const afterSignInUrl = `${pathname}?${params.toString()}`;
  return afterSignInUrl;
};

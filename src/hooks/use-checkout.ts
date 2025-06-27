import { CrossCircledIcon } from "@radix-ui/react-icons";
import { loadStripe } from "@stripe/stripe-js";
import { atom, useAtom } from "jotai";
import { notify } from "src/components/notifications";
import { captureError } from "src/infra/error-tracking";
import { translate } from "src/infra/i18n";
import { Plan } from "src/user-plan";

const stripeSDK = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
);

export type PaymentType = "monthly" | "yearly";

const checkoutLoadingAtom = atom<boolean>(false);

export const useCheckout = () => {
  const [isLoading, setLoading] = useAtom(checkoutLoadingAtom);

  const startCheckoutImpl = async (plan: Plan, paymentType: PaymentType) => {
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
        Icon: CrossCircledIcon,
      });
    }
  };

  return { startCheckout: startCheckoutImpl, isLoading };
};

export const startCheckout = async (plan: Plan, paymentType: PaymentType) => {
  const stripe = await stripeSDK;
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

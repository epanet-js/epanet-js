import { ReactNode, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { captureError } from "src/infra/error-tracking";
import { Button } from "./elements";
import { Plan } from "src/user-plan";
import { useUserTracking } from "src/infra/user-tracking";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { notify } from "./notifications";
import { translate } from "src/infra/i18n";
import { CrossCircledIcon } from "@radix-ui/react-icons";

const stripeSDK = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
);

export type PaymentType = "monthly" | "yearly";

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

const buildCheckoutUrl = (plan: Plan, paymentType: PaymentType) => {
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

export const CheckoutButton = ({
  variant = "primary",
  plan,
  paymentType,
  children,
}: {
  plan: Plan;
  paymentType: PaymentType;
  variant?: "primary" | "quiet";
  children: ReactNode;
}) => {
  const [isLoading, setLoading] = useState(false);
  const userTracking = useUserTracking();
  const { isSignedIn } = useAuth();

  const handleCheckout = async () => {
    setLoading(true);
    userTracking.capture({
      name: "checkout.started",
      plan,
      paymentType,
    });

    try {
      await startCheckout(plan, paymentType);
    } catch (error) {
      captureError(error as Error);
      notify({
        variant: "error",
        title: translate("somethingWentWrong"),
        description: translate("tryAgainOrSupport"),
        Icon: CrossCircledIcon,
      });
      setLoading(false);
    }
  };

  if (!isSignedIn) {
    return (
      <SignInButton forceRedirectUrl={buildCheckoutUrl(plan, paymentType)}>
        <Button
          onClick={() => {
            userTracking.capture({
              name: "checkout.started",
              plan,
              paymentType,
            });
          }}
          variant={variant}
          size="full-width"
        >
          {children}
        </Button>
      </SignInButton>
    );
  }

  return (
    <Button onClick={handleCheckout} variant={variant} size="full-width">
      {isLoading ? "Processing..." : children}
    </Button>
  );
};

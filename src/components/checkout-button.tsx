import { ReactNode } from "react";
import { Button } from "./elements";
import { Plan } from "src/user-plan";
import { useUserTracking } from "src/infra/user-tracking";
import { SignInButton, useAuth } from "@clerk/nextjs";
import {
  PaymentType,
  buildCheckoutUrl,
  useCheckout,
} from "src/hooks/use-checkout";

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
  const { startCheckout } = useCheckout();
  const userTracking = useUserTracking();
  const { isSignedIn } = useAuth();

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
    <Button
      onClick={() => startCheckout(plan, paymentType)}
      variant={variant}
      size="full-width"
    >
      {children}
    </Button>
  );
};

import { ReactNode } from "react";
import { Button } from "./elements";
import { Plan } from "src/lib/account-plans";
import { useUserTracking } from "src/infra/user-tracking";
import { PaymentType, useCheckout } from "src/hooks/use-checkout";
import type { UpgradeOrigin } from "src/state/dialog";

export const CheckoutButton = ({
  variant = "primary",
  plan,
  paymentType,
  source = "menu",
  feature = "upgradeMenu",
  children,
}: {
  plan: Plan;
  paymentType: PaymentType;
  variant?: "primary" | "quiet" | "default";
  source?: UpgradeOrigin;
  feature?: string;
  children: ReactNode;
}) => {
  const { startCheckout } = useCheckout();
  const userTracking = useUserTracking();

  const captureCheckoutStarted = () => {
    userTracking.capture({
      name: "checkout.started",
      plan,
      paymentType,
      source,
      sourceFeature: feature,
    });
  };

  return (
    <Button
      onClick={() => {
        captureCheckoutStarted();
        startCheckout(plan, paymentType);
      }}
      variant={variant}
      size="full-width"
    >
      {children}
    </Button>
  );
};

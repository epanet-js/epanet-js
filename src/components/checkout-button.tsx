import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { captureError } from "src/infra/error-tracking";
import { Button } from "./elements";

export const CheckoutButton = () => {
  const [isLoading, setLoading] = useState(false);
  const [isError, setError] = useState(false);
  const stripeSDK = loadStripe(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
  );

  const handleCheckout = async () => {
    setLoading(true);

    try {
      const stripe = await stripeSDK;
      const response = await fetch("/api/stripe-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const { sessionId } = await response.json();

      await stripe?.redirectToCheckout({ sessionId });
    } catch (error) {
      captureError(error as Error);
      setError(true);
      setLoading(false);
      setTimeout(() => setError(false), 2000);
    }
  };

  if (isError) {
    return <>Error!</>;
    //return <Button variant="danger">Error!</Button>;
  }

  return (
    <Button onClick={handleCheckout} variant="primary">
      {isLoading ? "Processing..." : "Upgrade"}
    </Button>
  );
};

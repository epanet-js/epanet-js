import { NextResponse, NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { logger } from "src/infra/server-logger";

type Plan = "personal" | "pro";
type PaymentType = "monthly" | "yearly";

const pricingKeys: Record<Plan, Record<PaymentType, string | null>> = {
  pro: {
    monthly: "epanet-js_pro_monthly",
    yearly: "epanet-js_pro_yearly",
  },
  personal: {
    yearly: "epanet-js_personal_yearly",
    monthly: null,
  },
};

const pricingKeyFor = (plan: Plan, paymentType: PaymentType) => {
  const pricingKey = pricingKeys[plan][paymentType];
  if (!pricingKey)
    throw new Error(`Price not configured for ${plan}:${paymentType}`);

  return pricingKey;
};

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const body = await request.json();
  const { plan, paymentType } = body;

  logger.info(`Initiating checkout session for ${plan}:${paymentType}`);

  const user = await currentUser();
  const email = user?.emailAddresses[0].emailAddress;

  if (!email) {
    logger.error("Unable to retrieve user email");
    return new NextResponse("Error", { status: 500 });
  }

  const priceKey = pricingKeyFor(plan, paymentType);

  const successUrl = new URL(
    `/api/stripe-callback?session_id={CHECKOUT_SESSION_ID}&plan=${plan}&paymentType=${paymentType}`,
    request.url,
  );
  const cancelUrl = new URL("/?dialog=upgrade&FLAG_UPGRADE=true", request.url);

  const session = await createCheckoutSession(
    email,
    priceKey,
    successUrl,
    cancelUrl,
  );

  return NextResponse.json({ sessionId: session.id });
}

const createCheckoutSession = async (
  email: string,
  lookupKey: string,
  successUrl: URL,
  cancelUrl: URL,
): Promise<{ id: string }> => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    expand: ["data.product"], // Optional: Expand to get product details
  });
  if (!prices.data || prices.data.length === 0) {
    throw new Error(`Price with lookup key '${lookupKey}' not found.`);
  }

  const price = prices.data[0];

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
    automatic_tax: {
      enabled: true,
    },
    line_items: [
      {
        price: price.id,
        quantity: 1,
      },
    ],
    success_url: successUrl.toString(),
    cancel_url: cancelUrl.toString(),
  });

  return { id: session.id };
};

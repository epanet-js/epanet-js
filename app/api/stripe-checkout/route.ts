import { NextResponse, NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { logger } from "src/infra/server-logger";

type Plan = "personal" | "pro";
type PaymentType = "monthly" | "yearly";

const testPrices: Record<Plan, Record<PaymentType, string | null>> = {
  pro: {
    monthly: "price_1R8yfr4IVhHFIm8SlJFTS7dt",
    yearly: "price_1R8yhW4IVhHFIm8SP4X2X0YG",
  },
  personal: {
    yearly: "price_1R8yia4IVhHFIm8SYMJXeVqW",
    monthly: null,
  },
};

const priceIdFor = (plan: Plan, paymentType: PaymentType) => {
  const priceId = testPrices[plan][paymentType];
  if (!priceId)
    throw new Error(`Price not configured for ${plan}:${paymentType}`);

  return priceId;
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

  const priceId = priceIdFor(plan, paymentType);

  const successUrl = new URL(
    `/api/stripe-callback?session_id={CHECKOUT_SESSION_ID}`,
    request.url,
  );
  const cancelUrl = new URL("/", request.url);

  const session = await createCheckoutSession(
    email,
    priceId,
    successUrl,
    cancelUrl,
  );

  return NextResponse.json({ sessionId: session.id });
}

const createCheckoutSession = async (
  email: string,
  priceId: string,
  successUrl: URL,
  cancelUrl: URL,
): Promise<{ id: string }> => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl.toString(),
    cancel_url: cancelUrl.toString(),
  });

  return { id: session.id };
};

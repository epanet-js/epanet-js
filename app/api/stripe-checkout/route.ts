import { NextResponse, NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { logger } from "src/infra/server-logger";

const testProPrice = "price_1Q3TYcE455sU9CNvI20pEOAs";

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const user = await currentUser();
  const email = user?.emailAddresses[0].emailAddress;

  if (!email) {
    logger.error("Unable to retrieve user email");
    return new NextResponse("Error", { status: 500 });
  }

  const priceId = testProPrice;

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
    mode: "payment",
    payment_method_types: ["card"],
    customer_creation: "always",
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

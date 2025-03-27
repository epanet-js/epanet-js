import { NextResponse, NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { logger } from "src/infra/server-logger";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) return new NextResponse("Unauthorized", { status: 401 });

  const user = await currentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const customerId = await obtainCutomerId(sessionId);
  if (!customerId) {
    logger.error(`Customer id is missing`);
    return new NextResponse("Error", { status: 500 });
  }

  //await upgradeUser(user, customerId)
  //await Promise.all([updateMailingSubscription(getEmail(user)), notifyUpgrade(getEmail(user))])

  return NextResponse.redirect(new URL("/", request.url));
}

const obtainCutomerId = async (sessionId: string): Promise<string | null> => {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return session.customer as string | null;
};

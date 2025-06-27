import { NextResponse, NextRequest } from "next/server";
import { User, auth, currentUser } from "@clerk/nextjs/server";
import { logger } from "src/infra/server-logger";
import Stripe from "stripe";
import { buildUserUpgradedMessage, sendWithoutCrashing } from "src/infra/slack";
import { upgradeUser } from "src/user-management";

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

  const plan = request.nextUrl.searchParams.get("plan");
  const paymentType = request.nextUrl.searchParams.get("paymentType");

  if (!plan || !paymentType) {
    logger.error(`Plan data is missing!`);
    return new NextResponse("Error", { status: 500 });
  }

  await upgradeUser(user, customerId, plan, paymentType);
  await notifyUpgrade(getEmail(user), plan, paymentType);

  return NextResponse.redirect(
    new URL("/?notification=checkoutSuccess", request.url),
  );
}

const obtainCutomerId = async (sessionId: string): Promise<string | null> => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return session.customer as string | null;
};

const notifyUpgrade = (email: string, plan: string, paymentType: string) => {
  const message = buildUserUpgradedMessage(email, plan, paymentType);
  return sendWithoutCrashing(message);
};

const getEmail = (user: User): string => {
  return user?.emailAddresses[0].emailAddress;
};

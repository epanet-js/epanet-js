import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { activateTrial } from "src/user-management";
import { logger } from "src/infra/server-logger";
import {
  buildTrialActivatedMessage,
  sendWithoutCrashing,
} from "src/infra/slack";

export async function POST() {
  const { userId } = await auth();

  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const user = await currentUser();

  if (!user) {
    logger.error("Unable to retrieve user for trial activation");
    return new NextResponse("Error", { status: 500 });
  }

  const hasUsedTrial = user.publicMetadata?.hasUsedTrial === true;
  const plan = user.publicMetadata?.userPlan || "free";

  if (hasUsedTrial) {
    logger.info(`User ${userId} already used trial`);
    return new NextResponse("Trial already used", { status: 400 });
  }

  if (plan !== "free") {
    logger.info(
      `User ${userId} is on ${String(plan)} plan, trial not applicable`,
    );
    return new NextResponse("Trial not available for current plan", {
      status: 400,
    });
  }

  logger.info(`Activating trial for user ${userId}`);
  await activateTrial(userId);

  const trialEndsAt = new Date(
    Date.now() + 14 * 24 * 60 * 60 * 1000,
  ).toLocaleDateString();

  const email = user.emailAddresses[0]?.emailAddress || "";
  const message = buildTrialActivatedMessage(
    email,
    user.firstName || "",
    user.lastName || "",
    trialEndsAt,
  );
  await sendWithoutCrashing(message);

  return NextResponse.json({ success: true });
}

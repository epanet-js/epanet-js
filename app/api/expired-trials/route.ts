import { NextRequest, NextResponse } from "next/server";
import { logger } from "src/infra/server-logger";
import { buildTrialExpiredMessage, sendWithoutCrashing } from "src/infra/slack";
import { getRecentlyExpiredTrials } from "src/user-management";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (
    process.env.CRON_SECRET &&
    request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  logger.info("Checking for expired trials");

  const expiredTrials = await getRecentlyExpiredTrials();

  logger.info(`Found ${expiredTrials.length} expired trials`);

  for (const user of expiredTrials) {
    const email = user.emailAddresses[0]?.emailAddress || "";
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    const trialActivatedAt =
      (user.publicMetadata?.trialActivatedAt as string) || "";
    const trialEndsAt = (user.publicMetadata?.trialEndsAt as string) || "";

    const message = buildTrialExpiredMessage(
      email,
      firstName,
      lastName,
      new Date(trialActivatedAt).toLocaleDateString(),
      new Date(trialEndsAt).toLocaleDateString(),
    );
    await sendWithoutCrashing(message);
  }

  await pingHeartbeat();

  return NextResponse.json({
    status: "success",
    expiredTrials: expiredTrials.length,
  });
}

const pingHeartbeat = async () => {
  const url = process.env.TRIAL_HEARTBEAT_URL;
  if (!url) return;

  try {
    await fetch(url);
  } catch (error) {
    logger.error(`Heartbeat ping failed: ${(error as Error).message}`);
  }
};

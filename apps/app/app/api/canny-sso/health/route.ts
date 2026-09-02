import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { logger } from "src/infra/server-logger";

export const dynamic = "force-dynamic";

const cannyBoardsUrl = "https://canny.io/api/v1/boards/list";
const timeoutMs = 5000;

export async function GET(request: NextRequest) {
  if (
    process.env.CRON_SECRET &&
    request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const privateKey = process.env.CANNY_PRIVATE_KEY;

  if (!privateKey) {
    return failure("CANNY_PRIVATE_KEY is not set");
  }

  try {
    const response = await fetch(cannyBoardsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ apiKey: privateKey }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return failure(`Canny rejected the key with status ${response.status}`);
    }

    return NextResponse.json({ status: "success" });
  } catch (error) {
    return failure(`Canny request failed: ${(error as Error).message}`);
  }
}

const failure = (reason: string): NextResponse => {
  const message = `Canny SSO health check failed: ${reason}`;

  logger.error(message);
  Sentry.captureMessage(message, "error");

  return NextResponse.json({ status: "error", reason }, { status: 503 });
};

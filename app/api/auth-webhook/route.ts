import { NextResponse, NextRequest } from "next/server";
import { WebhookEvent, UserJSON } from "@clerk/nextjs/server";
import { buildUserCreatedMessage, sendWithoutCrashing } from "src/infra/slack";
import { captureError } from "src/infra/error-tracking";
import { addToSubscribers } from "src/infra/newsletter";
import { logger } from "src/infra/server-logger";

type UserData = {
  email: string;
  firstName: string | null;
  lastName: string | null;
};

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  const configToken = process.env.CLERK_WEBHOOK_TOKEN;

  if (configToken && token !== configToken) {
    logger.info("Webhook token mismatch");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const payload: WebhookEvent = await request.json();
  if (payload.type === "user.created") {
    const userData = parseData(payload.data);

    const message = buildUserCreatedMessage(
      userData.email,
      userData.firstName || "",
      userData.lastName || "",
    );
    await sendWithoutCrashing(message);

    const result = await addToSubscribers(
      userData.email,
      userData.firstName,
      userData.lastName,
    );

    if (result.status === "failure") {
      captureError(new Error(`Unable to add ${userData.email} to subscribers`));

      return new NextResponse("Error", { status: 500 });
    }
  }

  return NextResponse.json({ status: "success" });
}

const parseData = (data: UserJSON): UserData => ({
  email: data.email_addresses[0].email_address,
  firstName: data.first_name,
  lastName: data.last_name,
});

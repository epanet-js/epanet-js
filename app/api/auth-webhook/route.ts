import { NextResponse, NextRequest } from "next/server";
import {
  WebhookEvent,
  UserJSON,
  UserWebhookEvent,
  DeletedObjectJSON,
} from "@clerk/nextjs/server";
import {
  buildUserCreatedMessage,
  buildUserDeletedMessage,
  sendWithoutCrashing,
} from "src/infra/slack";
import { captureError } from "src/infra/error-tracking";
import { addToSubscribers } from "src/infra/newsletter";
import { logger } from "src/infra/server-logger";
import { assignEducationPlan } from "src/user-management";

type UserData = {
  id: string;
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
    return handleUserCreated(payload);
  }
  if (payload.type === "user.deleted") {
    return handleUserDeleted(payload);
  }

  return NextResponse.json({ status: "success" });
}

const handleUserCreated = async (
  payload: UserWebhookEvent,
): Promise<NextResponse> => {
  const userData = parseData(payload.data as UserJSON);

  let planName = "Free";

  if (process.env.FLAG_SWOT === "true") {
    logger.info("Checking student email....");
    const isStudent = await checkStudentEmail(userData.email);
    if (isStudent) {
      await assignEducationPlan(userData.id, userData.email);
      planName = "Education";
    }
  }

  const message = buildUserCreatedMessage(
    userData.email,
    userData.firstName || "",
    userData.lastName || "",
    planName,
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

  return NextResponse.json({ status: "success" });
};

const checkStudentEmail = async (email: string) => {
  if (process.env.STUDENT_TEST_EMAIL === email) return true;

  const checkerUrl = "https://swot-checker.vercel.app/api/check";
  try {
    const response = await fetch(checkerUrl, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    return data.academic === true;
  } catch (error) {
    captureError(
      new Error(`Error checking student email: ${(error as Error).message}`),
    );
    return false;
  }
};

const handleUserDeleted = async (
  payload: UserWebhookEvent,
): Promise<NextResponse> => {
  const deleteData = payload.data as DeletedObjectJSON;

  const message = buildUserDeletedMessage(deleteData.id || "");
  await sendWithoutCrashing(message);
  return NextResponse.json({ status: "success" });
};

const parseData = (data: UserJSON): UserData => ({
  id: data.id,
  email: data.email_addresses[0].email_address,
  firstName: data.first_name,
  lastName: data.last_name,
});

import { captureError } from "./error-tracking";
import { logger } from "./server-logger";

export const sendWithoutCrashing = async (message: string) => {
  const webhookUrl = process.env.SLACK_USERS_WEBHOOK;
  if (!webhookUrl) {
    logger.info("No webhook configured, skipping notification...");
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: message,
    });

    if (!response.ok) {
      captureError(
        new Error(`Error sending message to Slack: ${response.statusText}`),
      );
    }
  } catch (error) {
    captureError(
      new Error(`Error sending message to Slack: ${(error as Error).message}`),
    );
  }
};

export const buildUserCreatedMessage = (
  email: string,
  firstName: string,
  lastName: string,
) => {
  return JSON.stringify({
    text: ":nerd_face: New User Created!",
    attachments: [
      {
        title: "User Details",
        fields: [
          {
            title: "Email",
            value: email,
            short: false,
          },
          {
            title: "First Name",
            value: firstName,
            short: true,
          },
          {
            title: "Last Name",
            value: lastName,
            short: true,
          },
        ],
      },
    ],
  });
};

export const buildUserDeletedMessage = (userId: string) => {
  return JSON.stringify({
    text: ":cry: User Deleted!",
    attachments: [
      {
        title: "User Details",
        fields: [
          {
            title: "Id",
            value: userId,
            short: false,
          },
        ],
      },
    ],
  });
};

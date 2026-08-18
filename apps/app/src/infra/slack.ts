import { Plan } from "src/lib/account-plans";
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
  plan: Plan,
) => {
  const emoji = plan === "education" ? ":nerd_face:" : ":smiley:";
  return JSON.stringify({
    text: `${emoji} New User Created!`,
    attachments: [
      {
        title: "User Details",
        fields: [
          {
            title: "Email",
            value: email,
            short: true,
          },
          {
            title: "Plan",
            value: plan,
            short: true,
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

export const buildTrialActivatedMessage = (
  email: string,
  firstName: string,
  lastName: string,
  trialEndsAt: string,
) => {
  return JSON.stringify({
    text: ":rocket: New Trial Activated!",
    attachments: [
      {
        title: "Trial Details",
        fields: [
          {
            title: "Email",
            value: email,
            short: true,
          },
          {
            title: "Trial Ends At",
            value: trialEndsAt,
            short: true,
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

export const buildTrialExpiredMessage = (
  email: string,
  firstName: string,
  lastName: string,
  trialActivatedAt: string,
  trialEndsAt: string,
) => {
  return JSON.stringify({
    text: ":hourglass: Trial Expired",
    attachments: [
      {
        title: "Trial Period Ended",
        color: "warning",
        fields: [
          {
            title: "Email",
            value: email,
            short: true,
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
          {
            title: "Activated At",
            value: trialActivatedAt,
            short: true,
          },
          {
            title: "Expired At",
            value: trialEndsAt,
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

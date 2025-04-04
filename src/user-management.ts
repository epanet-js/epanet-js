import { User, clerkClient as instanceClerkClient } from "@clerk/nextjs/server";
import { logger } from "./infra/server-logger";

type ClerkClient = Awaited<ReturnType<typeof instanceClerkClient>>;

export const assignEducationPlan = async (userId: string, email: string) => {
  logger.info(`Assigning education plan to user ${email}`);

  const clerk = await client();
  return clerk.users.updateUserMetadata(userId, {
    publicMetadata: {
      userPlan: "education",
    },
  });
};

export const upgradeUser = async (
  user: User,
  customerId: string,
  plan: string,
  paymentType: string,
) => {
  logger.info(`Upgrading user ${getEmail(user)} to ${plan}`);

  const clerk = await client();
  return clerk.users.updateUserMetadata(user.id, {
    publicMetadata: {
      userPlan: plan,
    },
    privateMetadata: {
      customerId,
      paymentType,
    },
  });
};

const getEmail = (user: User): string => {
  return user?.emailAddresses[0].emailAddress;
};

let instance: ClerkClient | null = null;
const client = async (): Promise<ClerkClient> => {
  if (instance) return instance;

  instance = await instanceClerkClient();
  return instance;
};

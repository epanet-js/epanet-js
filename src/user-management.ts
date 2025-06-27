import {
  User,
  UserJSON,
  clerkClient as instanceClerkClient,
} from "@clerk/nextjs/server";
import { logger } from "./infra/server-logger";

type ClerkClient = Awaited<ReturnType<typeof instanceClerkClient>>;

export type UserData = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

export const parseData = (data: UserJSON): UserData => ({
  id: data.id,
  email: data.email_addresses[0].email_address,
  firstName: data.first_name,
  lastName: data.last_name,
});

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
      paymentType,
    },
    privateMetadata: {
      customerId,
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

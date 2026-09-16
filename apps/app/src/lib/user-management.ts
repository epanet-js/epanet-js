import {
  UserJSON,
  clerkClient as instanceClerkClient,
} from "@clerk/nextjs/server";
import { logger } from "src/infra/server-logger";

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

let instance: ClerkClient | null = null;
const client = async (): Promise<ClerkClient> => {
  if (instance) return instance;

  instance = await instanceClerkClient();
  return instance;
};

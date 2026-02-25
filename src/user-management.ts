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

const TRIAL_DURATION_DAYS = 14;

export const activateTrial = async (userId: string) => {
  const now = new Date();
  const trialEndsAt = new Date(
    now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000,
  );

  const clerk = await client();
  return clerk.users.updateUserMetadata(userId, {
    publicMetadata: {
      trialActivatedAt: now.toISOString(),
      trialEndsAt: trialEndsAt.toISOString(),
      hasUsedTrial: true,
    },
  });
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const getRecentlyExpiredTrials = async () => {
  const now = Date.now();
  const oneDayAgo = now - MS_PER_DAY;

  const users = await fetchAllUsers();
  return users.filter((user) => {
    const hasUsedTrial = user.publicMetadata?.hasUsedTrial === true;
    const trialEndsAt = user.publicMetadata?.trialEndsAt as string | undefined;
    const plan = user.publicMetadata?.userPlan || "free";

    if (!hasUsedTrial || !trialEndsAt || plan !== "free") return false;

    const expiryTime = new Date(trialEndsAt).getTime();
    return expiryTime > oneDayAgo && expiryTime <= now;
  });
};

const fetchAllUsers = async () => {
  const clerk = await client();
  const result = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data } = await clerk.users.getUserList({
      orderBy: "+created_at",
      limit,
      offset,
    });

    result.push(...data);
    if (data.length < limit) break;

    offset += limit;
  }

  return result;
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

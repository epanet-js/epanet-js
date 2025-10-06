import { User } from "@clerk/nextjs/server";

export type CannyUserData = {
  avatarURL: string;
  email: string | undefined;
  id: string;
  name: string;
};

export const buildCannyAuthData = (user: User): CannyUserData => {
  const name = buildUserName(user);

  return {
    avatarURL: user.imageUrl,
    email: user.emailAddresses[0]?.emailAddress,
    id: user.id,
    name,
  };
};

const buildUserName = (user: User): string => {
  const firstName = user.firstName?.trim();
  const lastName = user.lastName?.trim();

  if (firstName && lastName) {
    return `${firstName} ${lastName.charAt(0)}.`;
  }

  if (firstName) {
    return firstName;
  }

  return buildFallbackUsername(user.id);
};

const buildFallbackUsername = (userId: string): string => {
  const prefix = "user_";
  const startIndex = userId.indexOf(prefix);

  if (startIndex === -1) {
    return `epanet-js ${userId.slice(0, 6)}`;
  }

  const afterPrefix = userId.slice(startIndex + prefix.length);
  const firstSixChars = afterPrefix.slice(0, 6);

  return `epanet-js user_${firstSixChars}`;
};

import { useCallback, useEffect, useState } from "react";
import {
  useAuth as useClerkAuth,
  useUser as useClerkUser,
} from "@clerk/nextjs";
import { isAuthEnabled } from "src/global-config";
import { nullUser, User, UseAuthHook } from "src/auth-types";
import { Plan } from "src/lib/account-plans";
import { allSupportedLanguages, Locale } from "src/infra/i18n/locale";

const AUTH_TIMEOUT_MS = 5000;

const useAuthWithClerk: UseAuthHook = () => {
  const { isSignedIn, userId, signOut, isLoaded } = useClerkAuth();
  const { user: clerkUser } = useClerkUser();

  const user: User = clerkUser
    ? {
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || "",
        firstName: clerkUser.firstName || undefined,
        lastName: clerkUser.lastName || undefined,
        plan: (clerkUser.publicMetadata?.userPlan || "free") as Plan,
        trialActivatedAt:
          (clerkUser.publicMetadata?.trialActivatedAt as string) ?? null,
        trialEndsAt: (clerkUser.publicMetadata?.trialEndsAt as string) ?? null,
        hasUsedTrial:
          (clerkUser.publicMetadata?.hasUsedTrial as boolean) ?? false,
        getLocale: () => {
          const savedLocale = clerkUser.unsafeMetadata?.locale as Locale;
          return savedLocale && allSupportedLanguages.includes(savedLocale)
            ? savedLocale
            : undefined;
        },
        setLocale: async (locale: Locale) => {
          await clerkUser.update({
            unsafeMetadata: {
              ...clerkUser.unsafeMetadata,
              locale,
            },
          });
        },
      }
    : nullUser;

  const reload = useCallback(async () => {
    await clerkUser?.reload();
  }, [clerkUser]);

  return { isSignedIn, isLoaded, userId, user, signOut, reload };
};

const useAuthWithTimeout: UseAuthHook = () => {
  const authData = useAuthWithClerk();
  const [isLoadedWithTimeout, setIsLoadedWithTimeout] = useState(false);

  useEffect(() => {
    if (authData.isLoaded) {
      setIsLoadedWithTimeout(true);
      return;
    }

    let isMounted = true;

    const intervalId = setInterval(() => {
      if (isMounted && authData.isLoaded) {
        setIsLoadedWithTimeout(true);
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      }
    }, 100);

    const timeoutId = setTimeout(() => {
      if (isMounted) {
        setIsLoadedWithTimeout(true);
        clearInterval(intervalId);
      }
    }, AUTH_TIMEOUT_MS);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [authData.isLoaded]);

  return {
    ...authData,
    isLoaded: isLoadedWithTimeout,
  };
};

const useAuthNull: UseAuthHook = () => {
  return {
    isLoaded: true,
    isSignedIn: false,
    userId: undefined,
    user: nullUser,
    signOut: () => {},
    reload: async () => {},
  };
};

export const useAuth = isAuthEnabled ? useAuthWithTimeout : useAuthNull;

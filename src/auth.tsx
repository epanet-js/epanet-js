import React, { useCallback, useEffect, useState } from "react";
import {
  ClerkProvider,
  SignedIn as ClerkSignedIn,
  SignedOut as ClerkSignedOut,
  SignInButton as ClerkSignInButton,
  SignUpButton as ClerkSignUpButton,
  UserButton as ClerkUserButton,
  RedirectToSignIn as ClerkRedirectToSignIn,
  useAuth as useClerkAuth,
  useUser as useClerkUser,
} from "@clerk/nextjs";
import { captureWarning } from "src/infra/error-tracking";
import { enUS, esES } from "@clerk/localizations";
import { getLocale, allSupportedLanguages, Locale } from "./infra/i18n/locale";
import { nullUser, User, UseAuthHook } from "./auth-types";
export { ClerkSignInButton, ClerkSignUpButton };
import { Plan } from "./user-plan";

const AUTH_TIMEOUT_MS = 5000;

export const isAuthEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const handleError = useCallback((error: Error) => {
    captureWarning(error.message);
  }, []);

  const clerkLocalization = getLocale() === "es" ? esES : enUS;

  if (!isAuthEnabled) {
    return children as JSX.Element;
  }

  return (
    // @ts-expect-error need to fix @types/react https://github.com/reduxjs/react-redux/issues/1886
    <ClerkProvider localization={clerkLocalization} onError={handleError}>
      {children}
    </ClerkProvider>
  );
};

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

  return { isSignedIn, isLoaded, userId, user, signOut };
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
  };
};

export const useAuth = isAuthEnabled ? useAuthWithTimeout : useAuthNull;

export const SignedIn = ({ children }: { children: React.ReactNode }) => {
  if (!isAuthEnabled) return null;
  return <ClerkSignedIn>{children}</ClerkSignedIn>;
};
export const SignedOut = ({ children }: { children: React.ReactNode }) => {
  if (!isAuthEnabled) return children as JSX.Element;
  return <ClerkSignedOut>{children}</ClerkSignedOut>;
};
export const UserButton = isAuthEnabled
  ? ClerkUserButton
  : () => <button></button>;

export const RedirectToSignIn = isAuthEnabled
  ? ClerkRedirectToSignIn
  : () => {
      return null;
    };

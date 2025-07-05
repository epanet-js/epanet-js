import React, { useCallback } from "react";
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
import { captureWarning } from "./infra/error-tracking";
import { enUS, esES } from "@clerk/localizations";
import { getLocale } from "./infra/i18n/locale";
import { nullUser, User, UseAuthHook } from "./auth-types";
export { ClerkSignInButton, ClerkSignUpButton };
import { Plan } from "./user-plan";

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
      }
    : nullUser;

  return { isSignedIn, isLoaded, userId, user, signOut };
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

export const useAuth = isAuthEnabled ? useAuthWithClerk : useAuthNull;

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

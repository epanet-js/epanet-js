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
import { B3Size, Button } from "./components/elements";
import { PersonIcon } from "@radix-ui/react-icons";
import { enUS, esES } from "@clerk/localizations";
import { getLocale } from "./infra/i18n/locale";
import { translate } from "./infra/i18n";
import { nullUser, User, UseAuthHook } from "./auth-types";
import { Plan } from "./user-plan";

const isAuthEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

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
  const { isSignedIn, userId, signOut } = useClerkAuth();
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

  return { isSignedIn, userId, user, signOut };
};

const useAuthNull: UseAuthHook = () => {
  return {
    isSignedIn: false,
    userId: undefined,
    user: nullUser,
    signOut: () => {},
  };
};

export const useAuth = isAuthEnabled ? useAuthWithClerk : useAuthNull;

export const SignInButton = ({
  onClick,
  autoFocus = false,
}: {
  onClick?: () => void;
  autoFocus?: boolean;
}) => {
  if (!isAuthEnabled) return null;
  return (
    <ClerkSignInButton>
      <Button
        variant="quiet"
        className="text-purple-500 font-semibold"
        autoFocus={autoFocus}
        onClick={onClick}
      >
        {translate("login")}
      </Button>
    </ClerkSignInButton>
  );
};

export const SignUpButton = ({
  onClick,
  autoFocus = false,
  size = "sm",
}: {
  size?: B3Size | "full-width";
  onClick?: () => void;
  autoFocus?: boolean;
}) => {
  if (!isAuthEnabled) return null;

  return (
    <ClerkSignUpButton>
      <Button
        variant="primary"
        size={size}
        onClick={onClick}
        autoFocus={autoFocus}
      >
        <PersonIcon /> {translate("register")}
      </Button>
    </ClerkSignUpButton>
  );
};

export const SignedIn = ({ children }: { children: React.ReactNode }) => {
  if (!isAuthEnabled) return null;
  // @ts-expect-error need to fix @types/react https://github.com/reduxjs/react-redux/issues/1886
  return <ClerkSignedIn>{children}</ClerkSignedIn>;
};
export const SignedOut = ({ children }: { children: React.ReactNode }) => {
  if (!isAuthEnabled) return children as JSX.Element;
  // @ts-expect-error need to fix @types/react https://github.com/reduxjs/react-redux/issues/1886
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

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
import { Button } from "./components/elements";
import { PersonIcon } from "@radix-ui/react-icons";
import { enUS, esES } from "@clerk/localizations";
import { getLocale } from "./infra/i18n/locale";
import { translate } from "./infra/i18n";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const handleError = useCallback((error: Error) => {
    captureWarning(error.message);
  }, []);

  const clerkLocalization = getLocale() === "es" ? esES : enUS;

  return (
    // @ts-expect-error need to fix @types/react https://github.com/reduxjs/react-redux/issues/1886
    <ClerkProvider localization={clerkLocalization} onError={handleError}>
      {children}
    </ClerkProvider>
  );
};

export type User = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

export const useAuth = () => {
  const { isSignedIn, userId } = useClerkAuth();
  const { user: clerkUser } = useClerkUser();

  const user: User | null = clerkUser
    ? {
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || "",
        firstName: clerkUser.firstName || undefined,
        lastName: clerkUser.lastName || undefined,
      }
    : null;

  return { isSignedIn, userId, user };
};

export const SignInButton = ({
  onClick,
  autoFocus = false,
}: {
  onClick?: () => void;
  autoFocus?: boolean;
}) => (
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

export const SignUpButton = ({
  onClick,
  autoFocus = false,
}: {
  onClick?: () => void;
  autoFocus?: boolean;
}) => (
  <ClerkSignUpButton>
    <Button variant="primary" onClick={onClick} autoFocus={autoFocus}>
      <PersonIcon /> {translate("register")}
    </Button>
  </ClerkSignUpButton>
);

export const SignedIn = ({ children }: { children: React.ReactNode }) => {
  // @ts-expect-error need to fix @types/react https://github.com/reduxjs/react-redux/issues/1886
  return <ClerkSignedIn>{children}</ClerkSignedIn>;
};
export const SignedOut = ({ children }: { children: React.ReactNode }) => {
  // @ts-expect-error need to fix @types/react https://github.com/reduxjs/react-redux/issues/1886
  return <ClerkSignedOut>{children}</ClerkSignedOut>;
};
export const UserButton = ClerkUserButton;

export const RedirectToSignIn = ClerkRedirectToSignIn;

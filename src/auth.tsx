import React, { useCallback } from "react";
import {
  ClerkProvider,
  SignedIn as ClerkSignedIn,
  SignedOut as ClerkSignedOut,
  SignInButton as ClerkSignInButton,
  SignUpButton as ClerkSignUpButton,
  UserButton as ClerkUserButton,
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

export const SignInButton = ({ onClick }: { onClick?: () => void }) => (
  <ClerkSignInButton>
    <Button
      variant="quiet"
      className="text-purple-500 font-semibold"
      onClick={onClick}
    >
      {translate("login")}
    </Button>
  </ClerkSignInButton>
);

export const SignUpButton = ({ onClick }: { onClick?: () => void }) => (
  <ClerkSignUpButton>
    <Button variant="primary" onClick={onClick}>
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

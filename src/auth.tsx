import React, { useCallback } from "react";
import {
  ClerkProvider,
  SignedIn as ClerkSignedIn,
  SignedOut as ClerkSignedOut,
  SignInButton as ClerkSignInButton,
  UserButton as ClerkUserButton,
} from "@clerk/nextjs";
import { captureWarning } from "./infra/error-tracking";
import { Button } from "./components/elements";
import { PersonIcon } from "@radix-ui/react-icons";
import { translate } from "./infra/i18n";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const handleError = useCallback((error: Error) => {
    captureWarning(error.message);
  }, []);
  // @ts-expect-error need to fix @types/react https://github.com/reduxjs/react-redux/issues/1886
  return <ClerkProvider onError={handleError}>{children}</ClerkProvider>;
};

export const SignInButton = () => (
  <ClerkSignInButton>
    <Button variant="primary">
      <PersonIcon /> {translate("signIn")}
    </Button>
  </ClerkSignInButton>
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

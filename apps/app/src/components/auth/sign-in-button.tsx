import React from "react";
import { SignInButton as ClerkSignInButton } from "@clerk/nextjs";
import { isAuthEnabled } from "src/global-config";

type Props = React.ComponentProps<typeof ClerkSignInButton>;

export const SignInButton: React.FC<Props> = isAuthEnabled
  ? ClerkSignInButton
  : ({ children }) => children;

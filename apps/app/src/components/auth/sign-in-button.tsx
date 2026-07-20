import React from "react";
import { SignInButton as ClerkSignInButton } from "@clerk/nextjs";
import { isAuthEnabled } from "src/global-config";

type Props = React.ComponentProps<typeof ClerkSignInButton>;

const SignInButtonInPopup: React.FC<Props> = ({ children, ...props }) => (
  <ClerkSignInButton {...props} mode="modal" oauthFlow="popup">
    {children}
  </ClerkSignInButton>
);

export const SignInButton: React.FC<Props> = isAuthEnabled
  ? SignInButtonInPopup
  : ({ children }) => children;

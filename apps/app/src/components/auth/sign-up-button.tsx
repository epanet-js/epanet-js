import React from "react";
import { SignUpButton as ClerkSignUpButton } from "@clerk/nextjs";
import { isAuthEnabled } from "src/global-config";

type Props = React.ComponentProps<typeof ClerkSignUpButton>;

const SignUpButtonInPopup: React.FC<Props> = ({ children, ...props }) => (
  <ClerkSignUpButton {...props} mode="modal" oauthFlow="popup">
    {children}
  </ClerkSignUpButton>
);

export const SignUpButton: React.FC<Props> = isAuthEnabled
  ? SignUpButtonInPopup
  : ({ children }) => children;

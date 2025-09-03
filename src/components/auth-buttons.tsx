import React from "react";
import {
  SignInButton as ClerkSignInButton,
  SignUpButton as ClerkSignUpButton,
} from "@clerk/nextjs";
import { Button, B3Size } from "./elements";
import { useTranslate } from "src/hooks/use-translate";
import { isAuthEnabled } from "src/auth";
import { UserIcon } from "src/icons";

export const SignInButton = ({
  onClick,
  autoFocus = false,
  children,
  forceRedirectUrl,
}: {
  onClick?: () => void;
  autoFocus?: boolean;
  children?: React.ReactNode;
  forceRedirectUrl?: string;
}) => {
  const translate = useTranslate();

  if (!isAuthEnabled) return null;

  return (
    <ClerkSignInButton forceRedirectUrl={forceRedirectUrl}>
      {!children && (
        <Button
          variant="quiet"
          className="text-purple-500 font-semibold"
          autoFocus={autoFocus}
          onClick={onClick}
        >
          {translate("login")}
        </Button>
      )}
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
  const translate = useTranslate();

  if (!isAuthEnabled) return null;

  return (
    <ClerkSignUpButton>
      <Button
        variant="primary"
        size={size}
        onClick={onClick}
        autoFocus={autoFocus}
      >
        <UserIcon /> {translate("register")}
      </Button>
    </ClerkSignUpButton>
  );
};

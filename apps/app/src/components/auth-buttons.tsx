import React from "react";
import { Button, B3Size } from "./elements";
import { useTranslate } from "src/hooks/use-translate";
import { isAuthEnabled } from "src/global-config";
import { UserIcon } from "src/icons";
import { SignInButton as AuthSignInButton } from "src/components/auth/sign-in-button";
import { SignUpButton as AuthSignUpButton } from "src/components/auth/sign-up-button";

export const SignInButton = ({
  onClick,
  autoFocus = false,
  children,
}: {
  onClick?: () => void;
  autoFocus?: boolean;
  children?: React.ReactNode;
}) => {
  const translate = useTranslate();

  if (!isAuthEnabled) return null;

  return (
    <AuthSignInButton>
      {!children && (
        <Button
          variant="quiet"
          className="text-accent font-semibold"
          autoFocus={autoFocus}
          onClick={onClick}
        >
          {translate("login")}
        </Button>
      )}
    </AuthSignInButton>
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
    <AuthSignUpButton>
      <Button
        variant="primary"
        size={size}
        onClick={onClick}
        autoFocus={autoFocus}
      >
        <UserIcon /> {translate("register")}
      </Button>
    </AuthSignUpButton>
  );
};

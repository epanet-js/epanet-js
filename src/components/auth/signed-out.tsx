import React from "react";
import { SignedOut as ClerkSignedOut } from "@clerk/nextjs";
import { isAuthEnabled } from "src/global-config";

export const SignedOut = ({ children }: { children: React.ReactNode }) => {
  if (!isAuthEnabled) return children as JSX.Element;
  return <ClerkSignedOut>{children}</ClerkSignedOut>;
};

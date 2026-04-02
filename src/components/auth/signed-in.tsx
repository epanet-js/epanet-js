import React from "react";
import { SignedIn as ClerkSignedIn } from "@clerk/nextjs";
import { isAuthEnabled } from "src/global-config";

export const SignedIn = ({ children }: { children: React.ReactNode }) => {
  if (!isAuthEnabled) return null;
  return <ClerkSignedIn>{children}</ClerkSignedIn>;
};

import React, { useCallback, useEffect } from "react";
import {
  ClerkProvider,
  useOrganization as useClerkOrganization,
  useOrganizationList as useClerkOrganizationList,
} from "@clerk/nextjs";
import { captureWarning } from "src/infra/error-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { enUS, esES } from "@clerk/localizations";
import { getLocale } from "src/infra/i18n/locale";
import { isAuthEnabled } from "src/global-config";

const ActivateOrganization = () => {
  const isOrgsOn = useFeatureFlag("FLAG_ORGS");
  const { organization } = useClerkOrganization();
  const { userMemberships, setActive } = useClerkOrganizationList({
    userMemberships: isOrgsOn || undefined,
  });

  useEffect(() => {
    if (organization) return;
    const firstMembership = userMemberships?.data?.[0];
    if (firstMembership) {
      void setActive?.({ organization: firstMembership.organization.id });
    }
  }, [organization, userMemberships?.data, setActive]);

  return null;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const handleError = useCallback((error: Error) => {
    captureWarning(error.message);
  }, []);

  const clerkLocalization = getLocale() === "es" ? esES : enUS;

  if (!isAuthEnabled) {
    return children as JSX.Element;
  }

  return (
    // @ts-expect-error need to fix @types/react https://github.com/reduxjs/react-redux/issues/1886
    <ClerkProvider localization={clerkLocalization} onError={handleError}>
      <ActivateOrganization />
      {children}
    </ClerkProvider>
  );
};

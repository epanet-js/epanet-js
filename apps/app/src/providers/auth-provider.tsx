import React, { useCallback, useEffect } from "react";
import {
  ClerkProvider,
  useOrganization as useClerkOrganization,
  useOrganizationList as useClerkOrganizationList,
} from "@clerk/nextjs";
import { useAtomValue } from "jotai";
import { captureWarning } from "src/infra/error-tracking";
import { enUS, esES, frFR, idID, jaJP, nlNL, ptBR } from "@clerk/localizations";
import type { Locale } from "@epanet-js/i18n/locale";
import { localeAtom } from "src/state/locale";
import { isAuthEnabled } from "src/global-config";

const clerkLocalizations: Record<Locale, typeof enUS> = {
  en: enUS,
  es: esES,
  pt: ptBR,
  fr: frFR,
  nl: nlNL,
  ja: jaJP,
  id: idID,
};

const ActivateOrganization = () => {
  const { organization } = useClerkOrganization();
  const { userMemberships, setActive } = useClerkOrganizationList({
    userMemberships: true,
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

  const locale = useAtomValue(localeAtom);
  const clerkLocalization = clerkLocalizations[locale];

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

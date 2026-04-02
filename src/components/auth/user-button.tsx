import React from "react";
import {
  UserButton as ClerkUserButton,
  useOrganization as useClerkOrganization,
  useClerk,
} from "@clerk/nextjs";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { isAuthEnabled } from "src/global-config";
import { Building } from "lucide-react";

const UserButtonWithManageTeam = () => {
  const { membership } = useClerkOrganization();
  const { openOrganizationProfile } = useClerk();
  const isOrgsOn = useFeatureFlag("FLAG_ORGS");
  const isOrgAdmin = isOrgsOn && membership?.role === "org:admin";

  if (!isOrgAdmin) return <ClerkUserButton />;

  return (
    <ClerkUserButton>
      <ClerkUserButton.MenuItems>
        <ClerkUserButton.Action
          label="Manage organization"
          labelIcon={<Building size={14} />}
          onClick={() => openOrganizationProfile()}
        />
      </ClerkUserButton.MenuItems>
    </ClerkUserButton>
  );
};

export const UserButton = isAuthEnabled
  ? UserButtonWithManageTeam
  : () => <button></button>;

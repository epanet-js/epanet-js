import React from "react";
import { UserButton as ClerkUserButton, useClerk } from "@clerk/nextjs";
import { usePermissions } from "src/hooks/use-permissions";
import { isAuthEnabled } from "src/global-config";
import { Building } from "lucide-react";

const UserButtonWithManageTeam = () => {
  const { openOrganizationProfile } = useClerk();
  const { canManageOrganization } = usePermissions();

  if (!canManageOrganization) return <ClerkUserButton />;

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

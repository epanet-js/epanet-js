import React from "react";
import { UserButton as ClerkUserButton, useClerk } from "@clerk/nextjs";
import { usePermissions } from "src/hooks/use-permissions";
import { useTranslate } from "src/hooks/use-translate";
import { useSignOut } from "src/commands/sign-out";
import { isAuthEnabled } from "src/global-config";
import { Building, LogOut } from "lucide-react";

const hideDefaultSignOut = {
  elements: {
    userButtonPopoverActionButton__signOut: { display: "none" },
  },
};

const UserButtonWithManageTeam = () => {
  const { openOrganizationProfile } = useClerk();
  const { canManageOrganization } = usePermissions();
  const translate = useTranslate();
  const signOut = useSignOut();

  return (
    <ClerkUserButton appearance={hideDefaultSignOut}>
      <ClerkUserButton.MenuItems>
        {canManageOrganization ? (
          <ClerkUserButton.Action
            label="Manage organization"
            labelIcon={<Building size={14} />}
            onClick={() => openOrganizationProfile()}
          />
        ) : null}
        <ClerkUserButton.Action
          label={translate("signOut")}
          labelIcon={<LogOut size={14} />}
          onClick={() => signOut({ source: "userMenu" })}
        />
      </ClerkUserButton.MenuItems>
    </ClerkUserButton>
  );
};

export const UserButton = isAuthEnabled
  ? UserButtonWithManageTeam
  : () => <button></button>;

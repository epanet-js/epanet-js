import React from "react";
import { UserButton as ClerkUserButton, useClerk } from "@clerk/nextjs";
import { useAuth } from "src/hooks/use-auth";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { usePermissions } from "src/hooks/use-permissions";
import { useTranslate } from "src/hooks/use-translate";
import { useBillingPortal } from "src/hooks/use-billing-portal";
import { useSignOut } from "src/commands/sign-out";
import { useUserTracking } from "src/infra/user-tracking";
import { hasBillingAccount, resolveTrialCta } from "src/lib/account-plans";
import { isAuthEnabled } from "src/global-config";
import { Building, CreditCard, LogOut } from "lucide-react";

const hideDefaultSignOut = {
  elements: {
    userButtonPopoverActionButton__signOut: { display: "none" },
  },
};

const UserButtonWithManageTeam = () => {
  const { openOrganizationProfile } = useClerk();
  const { canManageOrganization } = usePermissions();
  const { user } = useAuth();
  const isActivateTrialOn = useFeatureFlag("FLAG_ACTIVATE_TRIAL");
  const translate = useTranslate();
  const signOut = useSignOut();
  const userTracking = useUserTracking();
  const { openBillingPortal } = useBillingPortal();

  const manageBilling = () => {
    userTracking.capture({
      name: "billingPortal.opened",
      source: "userMenu",
      trial: resolveTrialCta(user).kind,
    });
    openBillingPortal();
  };

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
        {isActivateTrialOn && hasBillingAccount(user) ? (
          <ClerkUserButton.Action
            label={translate("billing")}
            labelIcon={<CreditCard size={14} />}
            onClick={manageBilling}
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

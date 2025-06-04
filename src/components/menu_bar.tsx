import React, { memo } from "react";
import { FileInfo } from "src/components/file_info";
import {
  GitHubLogoIcon,
  KeyboardIcon,
  QuestionMarkCircledIcon,
  RocketIcon,
  SunIcon,
} from "@radix-ui/react-icons";
import * as DD from "@radix-ui/react-dropdown-menu";
import { Button, SiteIcon, DDContent, StyledItem } from "./elements";
import { DebugDropdown } from "./menu_bar/menu_bar_dropdown";
import { isDebugOn } from "src/infra/debug-mode";
import { translate } from "src/infra/i18n";
import { helpCenterUrl, sourceCodeUrl } from "src/global-config";
import {
  RedirectToSignIn,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
} from "src/auth";
import { useShowWelcome } from "src/commands/show-welcome";
import { useUserTracking } from "src/infra/user-tracking";
import { useShowShortcuts } from "src/commands/show-shortcuts";
import { isFeatureOn } from "src/infra/feature-flags";
import { canUpgrade } from "src/user-plan";
import { PlanBadge } from "./plan-badge";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";

export function MenuBarFallback() {
  return <div className="h-12 bg-gray-800"></div>;
}

export const BrandLogo = ({ textSize = "md", iconSize = "8", gapX = "0" }) => {
  return (
    <span
      className={`
          text-gray-500
          text-${textSize}
          inline-flex gap-x-${gapX} items-center`}
      title="Home"
    >
      <SiteIcon className={`w-${iconSize} h-${iconSize}`} />
      epanet-js
    </span>
  );
};

export const MenuBarPlay = memo(function MenuBar() {
  const userTracking = useUserTracking();
  const { user } = useAuth();
  const setDialogState = useSetAtom(dialogAtom);

  return (
    <div className="flex justify-between h-12 pr-2 text-black dark:text-white">
      <div className="flex items-center">
        <div className="py-1 pl-2 pr-2 inline-flex">
          <BrandLogo />
        </div>
        <FileInfo />
      </div>
      <div className="flex items-center gap-x-1">
        {isFeatureOn("FLAG_REPO") && (
          <a
            href={sourceCodeUrl}
            target="_blank"
            onClick={() => {
              userTracking.capture({ name: "repo.visited", source: "menu" });
            }}
          >
            <Button variant="quiet">
              <GitHubLogoIcon />
              {translate("openSource")}
            </Button>
          </a>
        )}
        {isDebugOn && <DebugDropdown />}

        <HelpDot />
        <Divider />
        <SignedIn>
          <div className="relative flex items-center px-2 gap-x-2">
            {isFeatureOn("FLAG_UPGRADE") && canUpgrade(user.plan) && (
              <Button
                variant="primary"
                onClick={() => {
                  userTracking.capture({
                    name: "upgradeButton.clicked",
                    source: "menu",
                  });
                  setDialogState({ type: "upgrade" });
                }}
              >
                <RocketIcon />
                {translate("upgrade")}
              </Button>
            )}
            <PlanBadge plan={user.plan} />
            <UserButton />
          </div>
        </SignedIn>
        <SignedOut>
          {!isFeatureOn("FLAG_GUEST") && <RedirectToSignIn />}
          {isFeatureOn("FLAG_GUEST") && (
            <div className="flex items-center gap-x-1">
              <SignInButton
                onClick={() => {
                  userTracking.capture({
                    name: "signIn.started",
                    source: "menu",
                  });
                }}
              />
              <SignUpButton
                onClick={() => {
                  userTracking.capture({
                    name: "signUp.started",
                    source: "menu",
                  });
                }}
              />
            </div>
          )}
        </SignedOut>
      </div>
    </div>
  );
});

export const MenuBar = memo(function MenuBar() {
  return (
    <div className="flex justify-between h-12 pr-3 text-black dark:text-white">
      <div className="flex items-center">
        <FileInfo />
      </div>
      <div className="flex items-center gap-x-2">
        {isDebugOn && <DebugDropdown />}
        <HelpDot />
      </div>
    </div>
  );
});

export function HelpDot() {
  const showWelcome = useShowWelcome();
  const showShortcuts = useShowShortcuts();
  const userTracking = useUserTracking();

  return (
    <DD.Root>
      <DD.Trigger asChild>
        <Button variant="quiet">{translate("help")}</Button>
      </DD.Trigger>
      <DDContent side="bottom" align="end">
        <StyledItem
          onSelect={() => {
            showWelcome({ source: "menu" });
          }}
        >
          <SunIcon />
          {translate("welcomePage")}
        </StyledItem>
        <a
          href={helpCenterUrl}
          target="_blank"
          onClick={() => {
            userTracking.capture({
              name: "helpCenter.visited",
              source: "menu",
            });
          }}
        >
          <StyledItem>
            <QuestionMarkCircledIcon /> {translate("helpCenter")}
          </StyledItem>
        </a>
        <StyledItem
          onSelect={() => {
            userTracking.capture({
              name: "shortcuts.opened",
              source: "menu",
            });
            showShortcuts();
          }}
        >
          <KeyboardIcon />
          {translate("keyboardShortcuts")}
        </StyledItem>
      </DDContent>
    </DD.Root>
  );
}

export const Divider = () => {
  return <div className="border-r-2 border-gray-100 h-8 mr-1"></div>;
};

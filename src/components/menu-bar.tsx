import React, { memo, useRef, useState } from "react";
import { FileInfo } from "src/components/file-info";
import * as DD from "@radix-ui/react-dropdown-menu";
import {
  Button,
  DDContent,
  StyledItem,
  LogoIconAndWordmarkIcon,
} from "./elements";
import { DebugDropdown } from "./menu-bar/menu-bar-dropdown";
import { isDebugOn } from "src/infra/debug-mode";
import { useTranslate } from "src/hooks/use-translate";
import {
  helpCenterUrl,
  roadmapUrl,
  sourceCodeUrl,
  utilitiesUrl,
} from "src/global-config";
import { SignedIn, SignedOut, UserButton, useAuth } from "src/auth";
import { SignInButton, SignUpButton } from "./auth-buttons";
import { useShowWelcome } from "src/commands/show-welcome";
import { useUserTracking } from "src/infra/user-tracking";
import { useShowShortcuts } from "src/commands/show-shortcuts";
import { canUpgrade } from "src/user-plan";
import { PlanBadge } from "./plan-badge";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { LanguageSelector } from "./language-selector";

import {
  GlobeIcon,
  HelpIcon,
  RoadmapIcon,
  UtilitiesIcon,
  KeyboardIcon,
  MenuIcon,
  UpgradeIcon,
  NewFromExampleIcon,
  CloseIcon,
  GithubIcon,
} from "src/icons";

export function MenuBarFallback() {
  return <div className="h-12 bg-gray-800"></div>;
}

export const HeaderLogo = () => {
  return (
    <span className="pl-1" title="Home">
      <LogoIconAndWordmarkIcon size={98} />
      <span className="sr-only">epanet-js</span>
    </span>
  );
};

export const MenuBarPlay = memo(function MenuBar() {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const { user } = useAuth();
  const setDialogState = useSetAtom(dialogAtom);
  const showWelcome = useShowWelcome();
  const isMdOrLarger = useBreakpoint("md");
  const isSmOrLarger = useBreakpoint("sm");

  return (
    <div className="flex justify-between h-12 pr-2 text-black dark:text-white">
      <div className="flex items-center">
        <div
          className="py-1 pl-2 pr-2 inline-flex cursor-pointer"
          onClick={() => showWelcome({ source: "menu" })}
        >
          <HeaderLogo />
        </div>
        {isSmOrLarger && <FileInfo />}
      </div>
      <div className="flex items-center gap-x-1">
        {isMdOrLarger && (
          <>
            <a
              href={sourceCodeUrl}
              target="_blank"
              onClick={() => {
                userTracking.capture({ name: "repo.visited", source: "menu" });
              }}
            >
              <Button variant="quiet">
                <GithubIcon />
                {translate("openSource")}
              </Button>
            </a>
            {isDebugOn && <DebugDropdown />}
            <HelpDot />
            <LanguageSelector />
            <Divider />
          </>
        )}
        <SignedIn>
          <div className="relative flex items-center px-2 gap-x-2">
            {canUpgrade(user.plan) && (
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
                <UpgradeIcon />
                {translate("upgrade")}
              </Button>
            )}
            {isMdOrLarger && (
              <>
                <PlanBadge plan={user.plan} />
                <UserButton />
              </>
            )}
          </div>
        </SignedIn>
        <SignedOut>
          <div className="flex items-center gap-x-1">
            {isMdOrLarger && (
              <SignInButton
                onClick={() => {
                  userTracking.capture({
                    name: "signIn.started",
                    source: "menu",
                  });
                }}
              />
            )}
            <SignUpButton
              onClick={() => {
                userTracking.capture({
                  name: "signUp.started",
                  source: "menu",
                });
              }}
            />
          </div>
        </SignedOut>
        <SideMenu />
      </div>
    </div>
  );
});

export function HelpDot() {
  const translate = useTranslate();
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
          <NewFromExampleIcon />
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
            <HelpIcon />
            {translate("helpCenter")}
          </StyledItem>
        </a>
        <a
          href={roadmapUrl}
          target="_blank"
          onClick={() => {
            userTracking.capture({
              name: "roadmap.visited",
              source: "menu",
            });
          }}
        >
          <StyledItem>
            <RoadmapIcon />
            {translate("roadmap")}
          </StyledItem>
        </a>
        <a
          href={utilitiesUrl}
          target="_blank"
          onClick={() => {
            userTracking.capture({
              name: "utilities.visited",
              source: "menu",
            });
          }}
        >
          <StyledItem>
            <UtilitiesIcon />
            {translate("utilities")}
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
          {translate("keyboardShortcuts.title")}
        </StyledItem>
      </DDContent>
    </DD.Root>
  );
}

export const Divider = () => {
  return <div className="border-r-2 border-gray-100 h-8 mr-1"></div>;
};

export const SideMenu = () => {
  const translate = useTranslate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const userTracking = useUserTracking();
  const setDialogState = useSetAtom(dialogAtom);
  const showWelcome = useShowWelcome();
  const { user } = useAuth();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <div className="flex justify-end md:hidden">
        <Button variant="quiet" onClick={toggleMenu}>
          <MenuIcon />
        </Button>
      </div>

      <div
        ref={menuRef}
        tabIndex={isOpen ? 0 : -1}
        className={`fixed inset-y-0 right-0 w-full bg-white transform ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } transition-transform duration-300 ease-in-out md:hidden z-40`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between pb-6">
            <HeaderLogo />
            <Button variant="quiet" onClick={toggleMenu}>
              <CloseIcon />
            </Button>
          </div>{" "}
          <nav>
            <ul className="flex flex-col items-start gap-2 text-gray-200">
              <li>
                <Button variant="quiet">
                  <GlobeIcon />
                  <LanguageSelector align="start" padding={false} asChild />
                </Button>
              </li>
            </ul>
            <hr className="my-4 border-gray-200" />
            <ul className="flex flex-col items-start gap-2  text-gray-200">
              <li>
                <a
                  href={sourceCodeUrl}
                  target="_blank"
                  onClick={() => {
                    setIsOpen(false);
                    userTracking.capture({
                      name: "repo.visited",
                      source: "menu",
                    });
                  }}
                >
                  <Button variant="quiet">
                    <GithubIcon />
                    {translate("openSource")}
                  </Button>
                </a>
              </li>
              {isDebugOn && (
                <li>
                  <DebugDropdown />
                </li>
              )}
              <li>
                <Button
                  variant="quiet"
                  onClick={() => {
                    setIsOpen(false);
                    showWelcome({ source: "menu" });
                  }}
                >
                  <NewFromExampleIcon />
                  {translate("welcomePage")}
                </Button>
              </li>

              <li>
                <a
                  href={helpCenterUrl}
                  target="_blank"
                  onClick={() => {
                    setIsOpen(false);
                    userTracking.capture({
                      name: "helpCenter.visited",
                      source: "menu",
                    });
                  }}
                >
                  <Button variant="quiet">
                    <HelpIcon />
                    {translate("helpCenter")}
                  </Button>
                </a>
              </li>
            </ul>
            <hr className="my-4 border-gray-200" />
            <SignedIn>
              <ul className="flex-col items-start gap-4">
                <li>
                  <UserButton />
                </li>
                {canUpgrade(user.plan) && (
                  <li className="py-4">
                    <Button
                      variant="primary"
                      size="full-width"
                      onClick={() => {
                        userTracking.capture({
                          name: "upgradeButton.clicked",
                          source: "menu",
                        });
                        setIsOpen(false);
                        setDialogState({ type: "upgrade" });
                      }}
                    >
                      <UpgradeIcon />
                      {translate("upgrade")}
                    </Button>
                  </li>
                )}
              </ul>
            </SignedIn>
            <SignedOut>
              <ul className="flex-col items-start gap-4">
                <li>
                  <SignInButton
                    onClick={() => {
                      userTracking.capture({
                        name: "signIn.started",
                        source: "menu",
                      });
                    }}
                  />
                </li>
                <li className="py-4">
                  <SignUpButton
                    size="full-width"
                    onClick={() => {
                      userTracking.capture({
                        name: "signUp.started",
                        source: "menu",
                      });
                    }}
                  />
                </li>
              </ul>
            </SignedOut>
          </nav>
        </div>
      </div>
    </div>
  );
};

import React, { memo, useRef, useState } from "react";
import { FileInfo } from "src/components/file-info";
import {
  CopyIcon,
  Cross1Icon,
  DownloadIcon,
  FileIcon,
  FilePlusIcon,
  GitHubLogoIcon,
  HamburgerMenuIcon,
  KeyboardIcon,
  QuestionMarkCircledIcon,
  RocketIcon,
  SunIcon,
} from "@radix-ui/react-icons";
import * as DD from "@radix-ui/react-dropdown-menu";
import { Button, SiteIcon, DDContent, StyledItem } from "./elements";
import { DebugDropdown } from "./menu-bar/menu-bar-dropdown";
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
import { useBreakpoint } from "src/hooks/use-breakpoint";
import clsx from "clsx";
import { useNewProject } from "src/commands/create-new-project";
import { useOpenInpFromFs } from "src/commands/open-inp-from-fs";
import { useSaveInp } from "src/commands/save-inp";

export function MenuBarFallback() {
  return <div className="h-12 bg-gray-800"></div>;
}

export const BrandLogo = ({
  variant = "light",
  textSize = "md",
  iconSize = "8",
  gapX = "0",
}: {
  variant?: "light" | "dark";
  textSize?: string;
  iconSize?: string;
  gapX?: string;
}) => {
  return (
    <span
      className={clsx(
        `
          text-${textSize}
          inline-flex gap-x-${gapX} items-center`,
        {
          "text-gray-500": variant === "light",
          "text-gray-200": variant === "dark",
        },
      )}
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
          <BrandLogo />
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
                <GitHubLogoIcon />
                {translate("openSource")}
              </Button>
            </a>
            {isDebugOn && <DebugDropdown />}
            <FileMenu />
            <HelpDot />
            <Divider />
          </>
        )}
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
            {isMdOrLarger && (
              <>
                <PlanBadge plan={user.plan} />
                <UserButton />
              </>
            )}
          </div>
        </SignedIn>
        <SignedOut>
          {!isFeatureOn("FLAG_GUEST") && <RedirectToSignIn />}
          {isFeatureOn("FLAG_GUEST") && (
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
          )}
        </SignedOut>
        <SideMenu />
      </div>
    </div>
  );
});

export const FileMenu = () => {
  const createNewProject = useNewProject();
  const openInpFromFs = useOpenInpFromFs();
  const saveInp = useSaveInp();

  return (
    <DD.Root>
      <DD.Trigger asChild>
        <Button variant="quiet">{translate("file")}</Button>
      </DD.Trigger>
      <DDContent side="bottom" align="end">
        <StyledItem
          onSelect={() => {
            void createNewProject({ source: "menu-bar" });
          }}
        >
          <FileIcon />
          {translate("newProject")}
        </StyledItem>
        <StyledItem
          onSelect={() => {
            void openInpFromFs({ source: "toolbar" });
          }}
        >
          <FilePlusIcon />
          {translate("openProject")}
        </StyledItem>
        <StyledItem
          onSelect={() => {
            void saveInp({ source: "menu-bar" });
          }}
        >
          <DownloadIcon />
          {translate("save")}
        </StyledItem>
        <StyledItem
          onSelect={() => {
            void saveInp({ source: "menu-bar", isSaveAs: true });
          }}
        >
          <CopyIcon />
          {translate("saveAs")}
        </StyledItem>
      </DDContent>
    </DD.Root>
  );
};

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

export const SideMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const userTracking = useUserTracking();
  const setDialogState = useSetAtom(dialogAtom);
  const showWelcome = useShowWelcome();
  const createNewProject = useNewProject();
  const openInpFromFs = useOpenInpFromFs();
  const saveInp = useSaveInp();
  const { user } = useAuth();
  const isMdOrLarger = useBreakpoint("md");

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <div className="flex justify-end md:hidden">
        <Button variant="quiet" onClick={toggleMenu}>
          <HamburgerMenuIcon />
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
            <BrandLogo />
            <Button variant="quiet" onClick={toggleMenu}>
              <Cross1Icon />
            </Button>
          </div>{" "}
          <nav>
            <ul className="flex flex-col items-start gap-2  text-gray-200">
              {isMdOrLarger && (
                <li>
                  <Button
                    variant="quiet"
                    onClick={() => {
                      setIsOpen(false);
                      void createNewProject({ source: "side-menu" });
                    }}
                  >
                    <FileIcon className="mr-2" />
                    {translate("newProject")}
                  </Button>
                </li>
              )}
              <li>
                <Button
                  variant="quiet"
                  onClick={() => {
                    setIsOpen(false);
                    void openInpFromFs({ source: "menu" });
                  }}
                >
                  <FilePlusIcon className="mr-2" />
                  {translate("openProject")}
                </Button>
              </li>
              <li>
                <Button
                  variant="quiet"
                  onClick={() => {
                    setIsOpen(false);
                    void saveInp({ source: "side-menu" });
                  }}
                >
                  <DownloadIcon className="mr-2" />
                  {translate("save")}
                </Button>
              </li>
              <li>
                <Button
                  variant="quiet"
                  onClick={() => {
                    setIsOpen(false);
                    void saveInp({ source: "side-menu", isSaveAs: true });
                  }}
                >
                  <CopyIcon className="mr-2" />
                  {translate("saveAs")}
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
                    <GitHubLogoIcon className="mr-2" />
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
                  <SunIcon className="mr-2" />
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
                    <QuestionMarkCircledIcon className="mr-2" />{" "}
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
                {isFeatureOn("FLAG_UPGRADE") && canUpgrade(user.plan) && (
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
                      <RocketIcon />
                      {translate("upgrade")}
                    </Button>
                  </li>
                )}
              </ul>
            </SignedIn>
            <SignedOut>
              {!isFeatureOn("FLAG_GUEST") && <RedirectToSignIn />}
              {isFeatureOn("FLAG_GUEST") && (
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
              )}
            </SignedOut>
          </nav>
        </div>
      </div>
    </div>
  );
};

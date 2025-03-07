import Link from "next/link";
import React, { memo } from "react";
import { FileInfo } from "src/components/file_info";
import {
  GitHubLogoIcon,
  KeyboardIcon,
  QuestionMarkCircledIcon,
  SunIcon,
} from "@radix-ui/react-icons";
import { MemoryInfo } from "src/components/map_info/memory_info";
import { usePersistence } from "src/lib/persistence/context";
import * as DD from "@radix-ui/react-dropdown-menu";
import { Button, SiteIcon, DDContent, StyledItem } from "./elements";
import { dialogAtom } from "src/state/jotai";
import { useSetAtom } from "jotai";
import { DebugDropdown } from "./menu_bar/menu_bar_dropdown";
import { isDebugOn } from "src/infra/debug-mode";
import { translate } from "src/infra/i18n";
import { helpCenterUrl, sourceCodeUrl } from "src/global-config";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "src/auth";
import { isFeatureOn } from "src/infra/feature-flags";
import { useShowWelcome } from "src/commands/show-welcome";

export function MenuBarFallback() {
  return <div className="h-12 bg-gray-800"></div>;
}

function WrappedFeatureCollectionInfo() {
  const p = usePersistence();
  const [meta] = p.useMetadata();
  return (
    <>
      <Link
        href="/"
        className="py-1 pl-1 pr-2
          dark:hover:bg-gray-700
          focus-visible:ring-1 focus-visible:ring-purple-300
          text-purple-500 hover:text-purple-700 dark:hover:text-purple-300"
        title="Home"
      >
        <SiteIcon className="w-8 h-8" />
      </Link>
      <MemoryInfo metadata={meta} />
    </>
  );
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
  return (
    <div className="flex justify-between h-12 pr-2 text-black dark:text-white">
      <div className="flex items-center">
        <div className="py-1 pl-2 pr-2 inline-flex">
          <BrandLogo />
        </div>
        <FileInfo />
      </div>
      <div className="flex items-center gap-x-1">
        <a href={sourceCodeUrl} target="_blank">
          <Button variant="quiet">
            <GitHubLogoIcon />
            {translate("openSource")}
          </Button>
        </a>
        {isDebugOn && <DebugDropdown />}

        <HelpDot />
        {isFeatureOn("FLAG_AUTH") && (
          <>
            <Divider />
            <SignedIn>
              <div className="flex items-center px-2">
                <UserButton />
              </div>
            </SignedIn>
            <SignedOut>
              <div className="flex items-center gap-x-1">
                <SignInButton />
                <SignUpButton />
              </div>
            </SignedOut>
          </>
        )}
      </div>
    </div>
  );
});

export const MenuBar = memo(function MenuBar() {
  return (
    <div className="flex justify-between h-12 pr-3 text-black dark:text-white">
      <div className="flex items-center">
        <WrappedFeatureCollectionInfo />
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
  const setDialogState = useSetAtom(dialogAtom);
  const showWelcome = useShowWelcome();

  return (
    <DD.Root>
      <DD.Trigger asChild>
        <Button variant="quiet">{translate("help")}</Button>
      </DD.Trigger>
      <DDContent side="bottom" align="end">
        <StyledItem
          onSelect={() => {
            showWelcome();
          }}
        >
          <SunIcon />
          {translate("welcomePage")}
        </StyledItem>
        <a href={helpCenterUrl} target="_blank">
          <StyledItem>
            <QuestionMarkCircledIcon /> {translate("helpCenter")}
          </StyledItem>
        </a>
        <StyledItem
          onSelect={() => {
            setDialogState({ type: "cheatsheet" });
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

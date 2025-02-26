import { useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";
import { DialogCloseX } from "src/components/dialog";
import { Button } from "src/components/elements";
import { BrandLogo } from "src/components/menu_bar";
import { dialogAtom } from "src/state/dialog_state";
import { useNewProject } from "./create-new-project";
import { useOpenInp } from "./open-inp";
import { useOpenInpFromUrl } from "./open-inp-from-url";
import { userSettingsAtom } from "src/state/user-settings";
import { Checkbox } from "src/components/form/Checkbox";
import {
  ArrowRightIcon,
  FileIcon,
  FilePlusIcon,
  GitHubLogoIcon,
  QuestionMarkCircledIcon,
} from "@radix-ui/react-icons";
import {
  helpCenterUrl,
  quickStartTutorialUrl,
  sourceCodeUrl,
} from "src/global-config";
import Image from "next/image";
import { translate } from "src/infra/i18n";
import { isFeatureOn } from "src/infra/feature-flags";

type DemoModel = {
  name: string;
  description: string;
  url: string;
  thumbnailUrl: string;
};
const demoModels: DemoModel[] = [
  {
    name: "Drumchapel",
    description: translate("demoUKStyleDescription"),
    url: "/example-models/01-uk-style.inp",
    thumbnailUrl: "/example-models/01-uk-style.png",
  },
  {
    name: "Waterdown",
    description: translate("demoUSStyleDescription"),
    url: "/example-models/02-us-style.inp",
    thumbnailUrl: "/example-models/02-us-style.png",
  },
];

export const useShowWelcome = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const showWelcome = useCallback(() => {
    setDialogState({ type: "welcome" });
  }, [setDialogState]);

  return showWelcome;
};

export const WelcomeDialog = ({}: { onClose: () => void }) => {
  const [userSettings, setUserSettings] = useAtom(userSettingsAtom);
  const createNew = useNewProject();
  const { openInpFromFs } = useOpenInp();
  const { openInpFromUrl } = useOpenInpFromUrl();

  return (
    <div className="w-full flex flex-col h-full p-5 justify-between">
      <div className="flex flex-col flex-grow">
        <div className="w-full flex flex-row justify-between items-center pb-4">
          <BrandLogo textSize="2xl" iconSize="12" gapX="1" />
          <DialogCloseX />
        </div>
        <div className="flex-grow flex flex-col items-stretch flex-1 p-1 justify-between">
          <p className="text-gray-500 text-lg font-semibold pb-2">
            {translate("welcomeToEpanetJs")}
          </p>
          <p className="text-sm pb-4">{translate("welcomeIntro")}</p>
          <hr className="mb-4" />
          <div className="flex-grow grid grid-cols-4 gap-4 pb-3">
            <div className="col-span-3">
              <p className="text-gray-500 text-lg font-semibold pb-2">
                {translate("gettingStarted")}
              </p>
              <p className="text-sm pb-3">
                {translate("welcomeNewHere", translate("quickStartTutorial"))}
              </p>
              <p className="text-sm pb-6">
                <a href={quickStartTutorialUrl} target="_blank">
                  <Button variant="primary">
                    <ArrowRightIcon />
                    {translate("quickStartTutorial")}
                  </Button>
                </a>
              </p>
              <p className="text-sm pb-3">
                {translate("welcomeExploreWithSamples")}:
              </p>
              <div className="flex items-center gap-x-5  pb-3">
                {demoModels.map((demoModel, i) => (
                  <DemoNetworkCard
                    key={i}
                    title={demoModel.name}
                    description={demoModel.description}
                    thumbnailUrl={demoModel.thumbnailUrl}
                    onClick={() => openInpFromUrl(demoModel.url)}
                  />
                ))}
              </div>
            </div>
            <div className="col-span-1">
              <p className="text-gray-500 text-lg font-semibold pb-2">
                {translate("welcomeBuildAndDevelop")}
              </p>
              <div className="flex flex-col items-start gap-y-2 pb-3">
                <Button variant="quiet" onClick={createNew}>
                  <FileIcon />
                  {translate("createNew")}
                </Button>
                <Button variant="quiet" onClick={openInpFromFs}>
                  <FilePlusIcon />
                  {translate("openProject")}
                </Button>
                <a href={helpCenterUrl} target="_blank">
                  <Button variant="quiet">
                    <QuestionMarkCircledIcon />
                    {translate("helpCenter")}
                  </Button>
                </a>
                {isFeatureOn("FLAG_WELCOME") && (
                  <a href={sourceCodeUrl} target="_blank">
                    <Button variant="quiet">
                      <GitHubLogoIcon />
                      {translate("openSource")}
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs flex items-center gap-x-2">
              <Checkbox
                checked={userSettings.showWelcomeOnStart}
                onChange={() => {
                  setUserSettings((prev) => ({
                    ...prev,
                    showWelcomeOnStart: !prev.showWelcomeOnStart,
                  }));
                }}
              />
              {translate("alwaysShowAtStart")}
            </div>
            {isFeatureOn("FLAG_WELCOME") && (
              <div className="flex flex-row items-center mt-auto text-xs gap-x-1">
                <span>{translate("termsAndConditions")}</span>
                <span>|</span>
                <span>{translate("privacyPolicy")}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const DemoNetworkCard = ({
  title,
  description,
  thumbnailUrl,
  onClick,
}: {
  title: string;
  description: string;
  thumbnailUrl: string;
  onClick: () => void;
}) => {
  return (
    <div
      className="flex flex-col w-[250px] h-[290px] items-center gap-x-2 bg-white shadow-md  rounded-lg border cursor-pointer hover:bg-gray-400 hover:bg-opacity-10"
      onClick={onClick}
    >
      <Image
        src={thumbnailUrl}
        alt={title}
        width={247}
        height={200}
        quality={90}
        className="rounded-t-md object-cover"
      />
      <div className="flex flex-col p-3">
        <span className="text-gray-600 font-bold text-sm">{title}</span>
        <span className="text-xs">{description}</span>
      </div>
    </div>
  );
};

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
  FileIcon,
  FilePlusIcon,
  GitHubLogoIcon,
  QuestionMarkCircledIcon,
  VideoIcon,
} from "@radix-ui/react-icons";
import { helpCenterUrl, quickStartTutorialUrl } from "src/global-config";

type DemoModel = {
  name: string;
  description: string;
  url: string;
};
const demoModels: DemoModel[] = [
  {
    name: "UK Style Network",
    description: "Sample network for demo purposes",
    url: "/example-models/01-uk-style.inp",
  },
  {
    name: "US Style Network",
    description: "Sample network for demo purposes",
    url: "/example-models/02-us-style.inp",
  },
  {
    name: "US Style Network",
    description: "Sample network for demo purposes",
    url: "/example-models/02-us-style.inp",
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
            Welcome to epanet-js!
          </p>
          <p className="text-sm pb-4">
            epanet-js is a modern web-based EPANET platform, designed for
            utilities and those tackling complex distribution modeling. We’re
            reimagining the way planning engineers manage the future of their
            networks by replacing cumbersome, traditional desktop software with
            an intuitive, web-based tool.
          </p>
          <hr className="mb-4" />
          <div className="flex-grow grid grid-cols-4 gap-4 pb-3">
            <div className="col-span-3">
              <p className="text-gray-500 text-lg font-semibold pb-2">
                Getting started
              </p>
              <p className="text-sm pb-3">
                New here? Watch our Quick Start Tutorial to learn the basics in
                just a few minutes!
              </p>
              <p className="text-sm pb-6">
                <a href={quickStartTutorialUrl} target="_blank">
                  <Button variant="primary">
                    <VideoIcon />
                    Quick Start Tutorial
                  </Button>
                </a>
              </p>
              <p className="text-sm pb-2">
                Explore the app by opening a sample network:
              </p>
              <div className="flex items-center gap-x-4  pb-3">
                {demoModels.map((demoModel, i) => (
                  <DemoNetworkCard
                    key={i}
                    title={demoModel.name}
                    description={demoModel.description}
                    onClick={() => openInpFromUrl(demoModel.url)}
                  />
                ))}
              </div>
            </div>
            <div className="col-span-1">
              <p className="text-gray-500 text-lg font-semibold pb-2">
                Build and develop
              </p>
              <div className="flex flex-col items-start gap-y-2 pb-3">
                <Button variant="quiet" onClick={createNew}>
                  <FileIcon />
                  Create New
                </Button>
                <Button variant="quiet" onClick={openInpFromFs}>
                  <FilePlusIcon />
                  Open INP
                </Button>
                <a href={helpCenterUrl} target="_blank">
                  <Button variant="quiet">
                    <QuestionMarkCircledIcon />
                    Help Center
                  </Button>
                </a>
                <Button variant="quiet" onClick={openInpFromFs}>
                  <GitHubLogoIcon />
                  Source Code
                </Button>
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
              Always show at startup
            </div>
            <div className="flex flex-row items-center mt-auto text-xs gap-x-1">
              <span>Terms and Conditions</span>
              <span>|</span>
              <span>Privacy policy</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DemoNetworkCard = ({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) => {
  const demoPlaceholder = "https://placehold.co/198x160";

  return (
    <div
      className="flex flex-col w-[200px] h-[240px] items-center gap-x-2 bg-white shadow-md  rounded-lg border cursor-pointer hover:bg-gray-400 hover:bg-opacity-10"
      onClick={onClick}
    >
      <img
        src={demoPlaceholder}
        alt="Demo network 1"
        className="w-full h-[160px] rounded-t-md object-cover"
      />
      <div className="flex flex-col p-2">
        <span className="text-gray-600 font-bold text-sm">{title}</span>
        <span className="text-xs">{description}</span>
      </div>
    </div>
  );
};

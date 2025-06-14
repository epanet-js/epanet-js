import Image from "next/image";
import { useAtom } from "jotai";
import { useNewProject } from "src/commands/create-new-project";
import { useOpenInpFromFs } from "src/commands/open-inp-from-fs";
import { useOpenInpFromUrl } from "src/commands/open-inp-from-url";
import { translate } from "src/infra/i18n";
import { useUserTracking } from "src/infra/user-tracking";
import { userSettingsAtom } from "src/state/user-settings";
import {
  helpCenterUrl,
  privacyPolicyUrl,
  quickStartTutorialUrl,
  sourceCodeUrl,
  termsAndConditionsUrl,
} from "src/global-config";
import { Checkbox } from "../form/Checkbox";
import { Button } from "../elements";
import {
  ArrowRightIcon,
  FileIcon,
  FilePlusIcon,
  GitHubLogoIcon,
  QuestionMarkCircledIcon,
} from "@radix-ui/react-icons";
import { DialogCloseX, DialogContainer } from "../dialog";
import { BrandLogo } from "../menu_bar";
import { isFeatureOn } from "src/infra/feature-flags";
import { useBreakpoint } from "src/hooks/use-breakpoint";

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

export const WelcomeDialog = () => {
  const [userSettings, setUserSettings] = useAtom(userSettingsAtom);
  const createNew = useNewProject();
  const openInpFromFs = useOpenInpFromFs();
  const { openInpFromUrl } = useOpenInpFromUrl();
  const userTracking = useUserTracking();

  const handleOpenDemoModel = (demoModel: DemoModel) => {
    userTracking.capture({
      name: "exampleModel.clicked",
      modelName: demoModel.name,
    });
    void openInpFromUrl(demoModel.url);
  };

  const isMdOrLarger = useBreakpoint("md");

  return (
    <DialogContainer
      size={
        isFeatureOn("FLAG_RESPONSIVE") && !isMdOrLarger ? "fullscreen" : "md"
      }
    >
      <div className="w-full flex flex-col h-full justify-between">
        <div className="flex flex-col flex-grow">
          <div className="w-full flex flex-row justify-between items-center pb-4">
            <BrandLogo textSize="2xl" iconSize="12" gapX="1" />
            {(!isFeatureOn("FLAG_RESPONSIVE") || isMdOrLarger) && (
              <DialogCloseX />
            )}
          </div>
          <div className="flex-grow flex flex-col items-stretch flex-1 p-1 justify-between">
            <p className="text-gray-500 text-lg font-semibold pb-2">
              {translate("welcomeToEpanetJs")}
            </p>
            <p className="text-sm pb-4">{translate("welcomeIntro")}</p>
            <hr className="mb-4" />
            <div className="flex-grow flex flex-col md:grid md:grid-cols-4 gap-3 lg:gap-4  pb-3">
              <div className="col-span-3">
                <p className="text-gray-500 text-lg font-semibold pb-2">
                  {translate("gettingStarted")}
                </p>
                <p className="text-sm pb-3">
                  {translate("welcomeNewHere", translate("quickStartTutorial"))}
                </p>
                <p className="text-sm pb-6">
                  <a
                    href={quickStartTutorialUrl}
                    target="_blank"
                    onClick={() => {
                      userTracking.capture({
                        name: "quickStart.visited",
                        source: "welcome",
                      });
                    }}
                  >
                    <Button variant="primary">
                      <ArrowRightIcon />
                      {translate("quickStartTutorial")}
                    </Button>
                  </a>
                </p>
                <p className="text-sm pb-3">
                  {translate("welcomeExploreWithSamples")}:
                </p>
                <div className="flex flex-col sm:flex-row md:items-center gap-5  pb-3">
                  {demoModels.map((demoModel, i) => (
                    <DemoNetworkCard
                      key={i}
                      title={demoModel.name}
                      description={demoModel.description}
                      thumbnailUrl={demoModel.thumbnailUrl}
                      onClick={() => handleOpenDemoModel(demoModel)}
                    />
                  ))}
                </div>
              </div>
              <div className="col-span-1">
                <p className="text-gray-500 text-lg font-semibold pb-2">
                  {translate("welcomeBuildAndDevelop")}
                </p>
                <div className="flex items-start flex-col gap-2 pb-3">
                  {(!isFeatureOn("FLAG_RESPONSIVE") || isMdOrLarger) && (
                    <Button
                      variant="quiet"
                      onClick={() => {
                        userTracking.capture({
                          name: "newModel.started",
                          source: "welcome",
                        });

                        void createNew();
                      }}
                    >
                      <FileIcon />
                      {translate("createNew")}
                    </Button>
                  )}
                  <Button
                    variant="quiet"
                    onClick={() => {
                      void openInpFromFs({ source: "welcome" });
                    }}
                  >
                    <FilePlusIcon />
                    {translate("openProject")}
                  </Button>
                  <a
                    href={helpCenterUrl}
                    target="_blank"
                    onClick={() => {
                      userTracking.capture({
                        name: "helpCenter.visited",
                        source: "welcome",
                      });
                    }}
                  >
                    <Button variant="quiet">
                      <QuestionMarkCircledIcon />
                      {translate("helpCenter")}
                    </Button>
                  </a>
                  <a
                    href={sourceCodeUrl}
                    target="_blank"
                    onClick={() => {
                      userTracking.capture({
                        name: "repo.visited",
                        source: "welcome",
                      });
                    }}
                  >
                    <Button variant="quiet">
                      <GitHubLogoIcon />
                      {translate("openSource")}
                    </Button>
                  </a>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-around md:justify-between pb-2">
              {(!isFeatureOn("FLAG_RESPONSIVE") || isMdOrLarger) && (
                <div className="text-xs flex items-center gap-x-2">
                  <Checkbox
                    checked={userSettings.showWelcomeOnStart}
                    onChange={() => {
                      userSettings.showWelcomeOnStart
                        ? userTracking.capture({ name: "welcome.hidden" })
                        : userTracking.capture({ name: "welcome.enabled" });
                      setUserSettings((prev) => ({
                        ...prev,
                        showWelcomeOnStart: !prev.showWelcomeOnStart,
                      }));
                    }}
                  />
                  {translate("alwaysShowAtStart")}
                </div>
              )}
              <div className="flex flex-row items-center mt-auto text-xs gap-x-1">
                <a href={termsAndConditionsUrl} target="_blank">
                  {translate("termsAndConditions")}
                </a>
                <span>|</span>
                <a href={privacyPolicyUrl} target="_blank">
                  {translate("privacyPolicy")}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DialogContainer>
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
      className="flex flex-col w-full w-[250px] items-center gap-x-2 bg-w smhite shadow-md  rounded-lg border cursor-pointer hover:bg-gray-400 hover:bg-opacity-10"
      onClick={onClick}
    >
      <div className="flex-shrink-0">
        <Image
          src={thumbnailUrl}
          alt={title}
          width={247}
          height={200}
          //width={isMdOrLarger ? 247 : 180}
          //height={isMdOrLarger ? 200 : 146}
          quality={90}
          className="rounded-md object-cover"
        />
      </div>
      <div className="flex flex-col p-3">
        <span className="text-gray-600 font-bold text-sm">{title}</span>
        <span className="text-xs">{description}</span>
      </div>
    </div>
  );
};

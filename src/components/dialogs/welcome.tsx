import { useAtom } from "jotai";
import { useNewProject } from "src/commands/create-new-project";
import { useOpenInpFromFs } from "src/commands/open-inp-from-fs";
import { useOpenModelBuilder } from "src/commands/open-model-builder";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useUserTracking } from "src/infra/user-tracking";
import { userSettingsAtom } from "src/state/user-settings";
import {
  helpCenterUrl,
  landingPageUrl,
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
  FileTextIcon,
  GitHubLogoIcon,
  GlobeIcon,
  QuestionMarkCircledIcon,
  StarIcon,
} from "@radix-ui/react-icons";
import { DialogCloseX, DialogContainer } from "../dialog";
import { BrandLogo } from "../menu-bar";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { Message } from "../message";
import { DemoNetworkCard } from "../demo-network-card";

type DemoModel = {
  name: string;
  description: string;
  url: string;
  thumbnailUrl: string;
};
const getDemoModels = (
  translate: ReturnType<typeof useTranslate>,
): DemoModel[] => [
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
  const translate = useTranslate();
  const [userSettings, setUserSettings] = useAtom(userSettingsAtom);
  const createNew = useNewProject();
  const openInpFromFs = useOpenInpFromFs();
  const openModelBuilder = useOpenModelBuilder();
  const userTracking = useUserTracking();

  const isModelBuildEnabled = useFeatureFlag("FLAG_MODEL_BUILD");

  const isMdOrLarger = useBreakpoint("md");
  const demoModels = getDemoModels(translate);

  return (
    <DialogContainer size={!isMdOrLarger ? "fullscreen" : "md"}>
      <div className="w-full flex flex-col h-full justify-between">
        <div className="flex flex-col flex-grow">
          <div className="w-full flex flex-row justify-between items-center pb-4">
            <BrandLogo textSize="2xl" iconSize="12" gapX="1" />
            {isMdOrLarger && <DialogCloseX />}
          </div>
          <div className="flex-grow flex flex-col items-stretch flex-1 p-1 justify-between">
            <p className="text-gray-500 text-lg font-semibold pb-2">
              {translate("welcomeToEpanetJs")}
            </p>
            <p className="text-sm pb-4">{translate("welcomeIntro")}</p>
            {!isMdOrLarger && <SmallDeviceWarning />}
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
                <div className="flex flex-col sm:flex-row gap-6 pb-3">
                  {demoModels.map((demoModel, i) => (
                    <DemoNetworkCard key={i} demoNetwork={demoModel} />
                  ))}
                </div>
              </div>
              <div className="col-span-1">
                <p className="text-gray-500 text-lg font-semibold pb-2">
                  {translate("welcomeBuildAndDevelop")}
                </p>
                <div className="flex items-start flex-col gap-2 pb-3">
                  {isMdOrLarger && (
                    <Button
                      variant="quiet"
                      onClick={() => {
                        void createNew({ source: "welcome" });
                      }}
                    >
                      <FileIcon className="w-4 h-4 flex-shrink-0" />
                      {translate("startBlankProject")}
                    </Button>
                  )}
                  <Button
                    variant="quiet"
                    onClick={() => {
                      void openInpFromFs({ source: "welcome" });
                    }}
                  >
                    {isModelBuildEnabled ? (
                      <FileTextIcon className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <FilePlusIcon className="w-4 h-4 flex-shrink-0" />
                    )}
                    {translate("openProject")}
                  </Button>
                  {isModelBuildEnabled && (
                    <Button
                      variant="quiet"
                      onClick={() => {
                        userTracking.capture({
                          name: "gisImport.started",
                          source: "welcome",
                        });
                        openModelBuilder({ source: "welcome" });
                      }}
                    >
                      <GlobeIcon className="w-4 h-4 flex-shrink-0" />
                      {translate("importFromGIS")}
                      <StarIcon className="w-3 h-3 ml-1" />
                    </Button>
                  )}
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
                      <QuestionMarkCircledIcon className="w-4 h-4 flex-shrink-0" />
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
                      <GitHubLogoIcon className="w-4 h-4 flex-shrink-0" />
                      {translate("openSource")}
                    </Button>
                  </a>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-around md:justify-between pb-2">
              {isMdOrLarger && (
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

const SmallDeviceWarning = () => {
  const translate = useTranslate();
  return (
    <Message variant="warning" title={translate("headsUpSmallScreen")}>
      <p>{translate("smallScreenExplain")}</p>
      <hr className="my-4" />
      <p className="pb-2">{translate("hereYourOptions")}:</p>
      <div className="ml-2 space-y-2">
        <ul>
          <strong>{translate("continueAnyway")}</strong>:{" "}
          {translate("continueAnywayExplain")}
        </ul>
        <ul>
          <a className="underline" href={quickStartTutorialUrl}>
            <strong>{translate("watchQuickDemo")}</strong>
          </a>
          : {translate("watchQuickDemoExplain")}
        </ul>
        <ul>
          <a className="underline" href={landingPageUrl}>
            <strong>{translate("visitLandingPage")}</strong>
          </a>
          : {translate("visitLandingPageExplain")}
        </ul>
      </div>
    </Message>
  );
};

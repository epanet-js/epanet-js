import { useAtom } from "jotai";
import { useNewProject } from "src/commands/create-new-project";
import { useOpenInpFromFs } from "src/commands/open-inp-from-fs";
import { useOpenModelBuilder } from "src/commands/open-model-builder";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { userSettingsAtom } from "src/state/user-settings";
import {
  helpCenterUrl,
  landingPageUrl,
  privacyPolicyUrl,
  quickStartTutorialUrl,
  termsAndConditionsUrl,
} from "src/global-config";
import { Checkbox } from "../form/Checkbox";
import { Button, LogoIcon, LogoWordmark } from "../elements";
import {
  ArrowRightIcon,
  FileIcon,
  FileTextIcon,
  GlobeIcon,
  QuestionMarkCircledIcon,
  StarIcon,
} from "@radix-ui/react-icons";
import { DialogCloseX, DialogContainer } from "../dialog";
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

  const isMdOrLarger = useBreakpoint("md");
  const demoModels = getDemoModels(translate);

  return (
    <DialogContainer size="md">
      <div className="w-full flex flex-col h-full">
        <div className="absolute top-3 right-3">
          {isMdOrLarger && <DialogCloseX />}
        </div>
        {!isMdOrLarger && <SmallDeviceWarning />}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 items-center gap-3 pt-4 pb-8">
          <div className="col-span-1 flex flex-col justify-center gap-6">
            <div className="grid gap-2 justify-center justify-items-center">
              <LogoIcon size={40} />
              <LogoWordmark size={88} />
            </div>
            <div className="flex items-start flex-col gap-2">
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
                <FileTextIcon className="w-4 h-4 flex-shrink-0" />
                {translate("openProject")}
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  openModelBuilder({ source: "welcome" });
                }}
              >
                <GlobeIcon className="w-4 h-4 flex-shrink-0" />
                {translate("importFromGIS")}
                <StarIcon className="w-3 h-3 ml-1" />
              </Button>
            </div>
            <div className="flex items-start flex-col gap-2">
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
              <p className="text-sm">
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
            </div>
          </div>
          <div className="md:col-span-2">
            <h2 className="pb-2 font-bold text-gray-500">
              {translate("Demo networks")}
            </h2>
            <div className="grid grid-cols-2 gap-6">
              {demoModels.map((demoModel, i) => (
                <DemoNetworkCard key={i} demoNetwork={demoModel} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-around md:justify-between mt-auto">
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
          <div className="flex flex-row items-center text-xs gap-x-1">
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

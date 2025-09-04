import { useAtom } from "jotai";
import { useNewProject } from "src/commands/create-new-project";
import { useOpenInpFromFs } from "src/commands/open-inp-from-fs";
import { useOpenModelBuilder } from "src/commands/open-model-builder";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { userSettingsAtom } from "src/state/user-settings";
import { languageConfig } from "src/infra/i18n/locale";
import { useLocale, LocaleProvider } from "src/hooks/use-locale";
import {
  helpCenterUrl,
  landingPageUrl,
  privacyPolicyUrl,
  quickStartTutorialUrl,
  termsAndConditionsUrl,
} from "src/global-config";
import { Checkbox } from "../form/Checkbox";
import { Button, LogoIconAndWordmarkIcon } from "../elements";
import {
  ArrowRightIcon,
  FileIcon,
  FileSpreadsheetIcon,
  GlobeIcon,
  HelpIcon,
  EarlyAccessIcon,
} from "src/icons";
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

  const currentLocale = useLocale();
  const currentLanguage = languageConfig.find(
    (lang) => lang.code === currentLocale.locale,
  );
  const isExperimental = currentLanguage?.experimental ?? false;

  return (
    <DialogContainer size="md">
      <LocaleProvider>
        <div className="w-full flex flex-col">
          {isMdOrLarger && (
            <div className="flex justify-end">
              <DialogCloseX />
            </div>
          )}
          <div className="grid sm:grid-cols-3 gap-3 pb-8">
            <div className="col-span-1 md:w-max flex flex-col gap-6">
              <div className="pl-1">
                <LogoIconAndWordmarkIcon size={147} />
              </div>
              <div className="sm:hidden">
                <SmallDeviceWarning />
              </div>
              <div className="flex items-start flex-col gap-2">
                {isMdOrLarger && (
                  <Button
                    variant="quiet"
                    onClick={() => {
                      void createNew({ source: "welcome" });
                    }}
                  >
                    <FileIcon />
                    {translate("startBlankProject")}
                  </Button>
                )}
                <Button
                  variant="quiet"
                  onClick={() => {
                    void openInpFromFs({ source: "welcome" });
                  }}
                >
                  <FileSpreadsheetIcon />
                  {translate("openProject")}
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => {
                    openModelBuilder({ source: "welcome" });
                  }}
                >
                  <GlobeIcon />
                  {translate("importFromGIS")}
                  <EarlyAccessIcon size="sm" />
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
                    <HelpIcon />
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
            <div className="sm:col-span-2">
              <h2 className="mt-[.2rem] pt-2 pb-2 font-bold text-gray-500">
                {translate("demoNetworksTitle")}
              </h2>
              <div className="grid grid-cols-2 gap-6">
                {demoModels.map((demoModel, i) => (
                  <DemoNetworkCard key={i} demoNetwork={demoModel} />
                ))}
              </div>
            </div>
          </div>
          <div className="hidden sm:max-md:block mb-2">
            <SmallDeviceWarning />
          </div>
          {isExperimental && (
            <div className="mb-6">
              <Message
                variant="info"
                title={translate("startNotificationLanguageTitle")}
              >
                {translate("startNotificationLanguageDescription")}
              </Message>
            </div>
          )}
          <div className="flex pt-4 items-center justify-around md:justify-between mt-auto">
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
      </LocaleProvider>
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

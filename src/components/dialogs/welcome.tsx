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
import { DRUMCHAPEL, WATERDOWN } from "src/demo/demo-networks";
import optimaticsLogoUrl from "src/assets/images/logos/optimatics-logo-black.webp";

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
    name: DRUMCHAPEL.name,
    description: translate("demoUKStyleDescription"),
    url: DRUMCHAPEL.url,
    thumbnailUrl: DRUMCHAPEL.thumbnailUrl,
  },
  {
    name: WATERDOWN.name,
    description: translate("demoUSStyleDescription"),
    url: WATERDOWN.url,
    thumbnailUrl: WATERDOWN.thumbnailUrl,
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
        <div
          className="bg-white w-full flex flex-col"
          style={{ margin: "-2rem", width: "calc(100% + 4rem)" }}
        >
          {isMdOrLarger && (
            <div
              className="flex justify-end p-6 z-10"
              style={{ marginBottom: "-4rem" }}
            >
              <DialogCloseX />
            </div>
          )}
          <div className="grid sm:grid-cols-[min-content_1fr]">
            <div className="bg-gray-50 border-r border-gray-200 col-span-1 md:w-max flex flex-col p-6 gap-6">
              <div className="pl-1">
                <LogoIconAndWordmarkIcon size={147} />
              </div>
              <div className="sm:hidden">
                <SmallDeviceWarning />
              </div>
              <div className="h-full flex items-start flex-col gap-2">
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

                <div className="mt-4 flex items-start flex-col gap-2">
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

                <div className="flex flex-col gap-2 mt-auto text-xs">
                  {isMdOrLarger && (
                    <div className="mb-4 text-xs flex items-center gap-x-2">
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
                  <a href={termsAndConditionsUrl} target="_blank">
                    {translate("termsAndConditions")}
                  </a>
                  <a href={privacyPolicyUrl} target="_blank">
                    {translate("privacyPolicy")}
                  </a>
                </div>
              </div>
            </div>
            <div className="p-6">
              {isExperimental && (
                <div className="mt-7 mb-3">
                  <Message
                    variant="info"
                    title={translate("startNotificationLanguageTitle")}
                  >
                    {translate("startNotificationLanguageDescription")}
                  </Message>
                </div>
              )}

              <h2 className="mt-[.2rem] pt-2 pb-2 font-bold text-gray-500">
                {translate("demoNetworksTitle")}
              </h2>
              <div className="grid grid-cols-2 gap-6">
                {demoModels.map((demoModel, i) => (
                  <DemoNetworkCard key={i} demoNetwork={demoModel} />
                ))}
              </div>
              <div className="bg-gray-50 rounded-lg p-4 mt-6 text-xs text-center">
                <h3 className="text-gray-600 font-bold">
                  {translate("foundersPartnerTitle")}
                </h3>
                <a href="https://optimatics.com/" target="_blank">
                  <img
                    src={optimaticsLogoUrl.src}
                    className="block m-auto h-16"
                    height="64"
                  />
                </a>
                <p className="text-gray-600">
                  {translate("foundersPartnerDescription")}{" "}
                  <a
                    href="https://help.epanetjs.com/Founding-Partner-program-2f6e18c9f0f680d8be27c05c0b5844bb"
                    className="underline text-violet-500"
                  >
                    {translate("foundersPartnerLearnMore")}
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
          <div className="hidden sm:max-md:block mb-2">
            <SmallDeviceWarning />
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

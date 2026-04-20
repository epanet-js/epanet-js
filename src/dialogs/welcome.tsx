import { useNewProject } from "src/commands/create-new-project";
import { useOpenInpFromFs } from "src/commands/open-inp-from-fs";
import { useOpenInpFromUrl } from "src/commands/open-inp-from-url";
import { useOpenModelBuilder } from "src/commands/open-model-builder";
import { useOpenProject } from "src/commands/open-project";
import { useOpenRecentFile } from "src/commands/open-recent-file";
import { useTranslate } from "src/hooks/use-translate";
import { useRecentFiles } from "src/hooks/use-recent-files";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useUserTracking } from "src/infra/user-tracking";
import { languageConfig } from "src/infra/i18n/locale";
import { useLocale, LocaleProvider } from "src/hooks/use-locale";
import {
  helpCenterUrl,
  landingPageUrl,
  privacyPolicyUrl,
  quickStartTutorialUrl,
  termsAndConditionsUrl,
} from "src/global-config";
import {
  Button,
  Loading,
  LogoIconAndWordmarkIcon,
} from "../components/elements";
import {
  ArrowRightIcon,
  CloseIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FolderOpenIcon,
  GlobeIcon,
  HelpIcon,
  EarlyAccessIcon,
} from "src/icons";
import { BaseDialog, DialogCloseX, useDialogState } from "../components/dialog";
import { Message } from "../components/message";
import { DRUMCHAPEL, WATERDOWN } from "src/demo/demo-networks";
import optimaticsLogoUrl from "src/assets/images/logos/optimatics-logo-black.webp";
import affinityWaterLogoUrl from "src/assets/images/logos/affinity-water-logo.svg";
import iteratingLogoUrl from "src/assets/images/logos/iterating-logo-muted-padded.svg";
import type { RecentFileEntry } from "src/lib/recent-files";
import Image from "next/image";

export const WelcomeDialog = () => {
  const translate = useTranslate();
  const createNew = useNewProject();
  const openInpFromFs = useOpenInpFromFs();
  const openProject = useOpenProject();
  const openModelBuilder = useOpenModelBuilder();
  const userTracking = useUserTracking();
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");

  const currentLocale = useLocale();
  const currentLanguage = languageConfig.find(
    (lang) => lang.code === currentLocale.locale,
  );
  const isExperimental = currentLanguage?.experimental ?? false;

  const { closeDialog } = useDialogState();

  return (
    <BaseDialog size="lg" isOpen={true} onClose={closeDialog}>
      <LocaleProvider>
        <div className="relative grid sm:grid-cols-[min-content_1fr]">
          <div className="absolute top-6 right-6 z-10">
            <DialogCloseX />
          </div>
          <div className="bg-gray-50 sm:border-r border-b sm:border-b-0 border-gray-200 rounded-t-lg sm:rounded-t-none sm:rounded-tl-lg sm:rounded-bl-lg col-span-1 md:w-max flex flex-col p-6 gap-6">
            <div className="pl-1">
              <LogoIconAndWordmarkIcon size={147} />
            </div>
            <div className="sm:hidden">
              <SmallDeviceWarning />
            </div>
            <div className="h-full flex flex-col gap-2">
              <Button
                variant="quiet"
                onClick={() => {
                  void createNew({ source: "welcome" });
                }}
                className="hidden sm:flex"
                style={{ width: "100%" }}
              >
                <FileIcon />
                {translate("startBlankProject")}
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  if (isOurFileOn) {
                    openProject({ source: "welcome" });
                  } else {
                    void openInpFromFs({ source: "welcome" });
                  }
                }}
                style={{ width: "100%" }}
              >
                {isOurFileOn ? <FolderOpenIcon /> : <FileSpreadsheetIcon />}
                {translate("openProject")}
              </Button>
              {isOurFileOn && (
                <Button
                  variant="quiet"
                  onClick={() => {
                    void openInpFromFs({ source: "welcome" });
                  }}
                  style={{ width: "100%", marginTop: "0.5rem" }}
                >
                  <FileSpreadsheetIcon />
                  {translate("importINP")}
                </Button>
              )}
              <Button
                variant="quiet"
                onClick={() => {
                  openModelBuilder({ source: "welcome" });
                }}
                style={{ width: "100%" }}
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
                  style={{ width: "100%" }}
                >
                  <Button variant="quiet" style={{ width: "100%" }}>
                    <HelpIcon />
                    {translate("helpCenter")}
                  </Button>
                </a>
                <a
                  href={quickStartTutorialUrl}
                  target="_blank"
                  onClick={() => {
                    userTracking.capture({
                      name: "quickStart.visited",
                      source: "welcome",
                    });
                  }}
                  style={{ width: "100%" }}
                >
                  <Button variant="primary" style={{ width: "100%" }}>
                    <ArrowRightIcon />
                    {translate("quickStartTutorial")}
                  </Button>
                </a>
              </div>

              <div className="flex flex-col gap-2 mt-auto text-xs">
                <a href={termsAndConditionsUrl} target="_blank">
                  {translate("termsAndConditions")}
                </a>
                <a href={privacyPolicyUrl} target="_blank">
                  {translate("privacyPolicy")}
                </a>
              </div>
              <div className="flex items-center mt-2 text-xs text-gray-500">
                By
                <a href="https://iterating.ca" target="_blank">
                  <img src={iteratingLogoUrl.src} className="h-8" />
                </a>
              </div>
            </div>
          </div>
          <div className="p-6 min-w-0 flex flex-col overflow-hidden">
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

            <RecentNetworks />

            <FoundingPartners />
          </div>
        </div>
        <div className="hidden sm:max-md:block mb-2">
          <SmallDeviceWarning />
        </div>
      </LocaleProvider>
    </BaseDialog>
  );
};

const FoundingPartners = () => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const isFoundingAffinityEnabled = useFeatureFlag("FLAG_AFFINITY_LOGO");

  return (
    <div className="bg-gray-50 rounded-lg p-4 mt-6 text-xs text-center shrink-0">
      <h3 className="text-gray-600 font-bold">
        {translate("foundersPartnerTitle")}
      </h3>
      {isFoundingAffinityEnabled ? (
        <div className="flex gap-2 justify-center">
          <a
            href="https://optimatics.com/"
            target="_blank"
            onClick={() => {
              userTracking.capture({
                name: "foundersPartner.visited",
                link: "optimatics",
              });
            }}
          >
            <img
              src={optimaticsLogoUrl.src}
              className="block m-auto h-16"
              height="64"
            />
          </a>
          <a
            href="https://www.affinitywater.co.uk/"
            target="_blank"
            className="pt-4"
            onClick={() => {
              userTracking.capture({
                name: "foundersPartner.visited",
                link: "affinityWater",
              });
            }}
          >
            <img
              src={affinityWaterLogoUrl.src}
              className="block m-auto h-4"
              height="16"
            />
          </a>
        </div>
      ) : (
        <a
          href="https://optimatics.com/"
          target="_blank"
          onClick={() => {
            userTracking.capture({
              name: "foundersPartner.visited",
              link: "optimatics",
            });
          }}
        >
          <img
            src={optimaticsLogoUrl.src}
            className="block m-auto h-16"
            height="64"
          />
        </a>
      )}
      <p className="text-gray-600">
        {translate("foundersPartnerDescription")}{" "}
        <a
          href="https://help.epanetjs.com/Founding-Partner-program-2f6e18c9f0f680d8be27c05c0b5844bb"
          target="_blank"
          className="underline text-violet-500"
          onClick={() => {
            userTracking.capture({
              name: "foundersPartner.visited",
              link: "foundersPartners",
            });
          }}
        >
          {translate("foundersPartnerLearnMore")}
        </a>
        .
      </p>
    </div>
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

const DemoNetworks = () => {
  const translate = useTranslate();

  const demoModels = [
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

  return (
    <div>
      <h2 className="pt-2 pb-2 font-bold text-gray-500">
        {translate("demoNetworksTitle")}
      </h2>

      <div className="grid grid-cols-2 gap-6 h-[270px]">
        {demoModels.map((demoModel, i) => (
          <DemoNetworkCard key={i} demoNetwork={demoModel} />
        ))}
      </div>
    </div>
  );
};

const RecentNetworks = () => {
  const translate = useTranslate();
  const {
    recentFiles,
    isLoading: isRecentFilesLoading,
    removeRecent,
    isSupported: isRecentFilesSupported,
  } = useRecentFiles();
  const openRecentFile = useOpenRecentFile();
  const hasRecentFiles = recentFiles.length > 0;

  const demoModels = [
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

  if (!isRecentFilesSupported) return <DemoNetworks />;

  if (!isRecentFilesLoading && !hasRecentFiles) return <DemoNetworks />;

  if (isRecentFilesLoading)
    return (
      <div className="flex h-[310px]">
        <Loading />
      </div>
    );

  return (
    <>
      <h2 className="pt-2 pb-2 font-bold text-gray-500">
        {translate("recentNetworks")}
      </h2>
      <div className="overflow-y-auto min-h-0 scroll-shadows h-[270px]">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {recentFiles.map((entry) => (
            <RecentFileCard
              key={entry.id}
              entry={entry}
              onOpen={() => openRecentFile(entry, "welcome")}
              onRemove={() => void removeRecent(entry.id)}
            />
          ))}
          {demoModels.map((demo, i) => (
            <DemoAsRecentCard key={`demo-${i}`} demoNetwork={demo} />
          ))}
        </div>
      </div>
    </>
  );
};

const RecentFileCard = ({
  entry,
  onOpen,
  onRemove,
}: {
  entry: RecentFileEntry;
  onOpen: () => void;
  onRemove: () => void;
}) => (
  <div
    className="group flex flex-col rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50 overflow-hidden min-w-0"
    onClick={onOpen}
  >
    <div
      className="relative bg-gray-100 shrink-0"
      style={{ aspectRatio: "5/4" }}
    >
      <Button
        variant="default"
        size="xxs"
        className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label="Remove"
      >
        <CloseIcon />
      </Button>
      {entry.thumbnail ? (
        <img
          src={entry.thumbnail}
          alt={entry.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <FileSpreadsheetIcon className="text-gray-300" />
        </div>
      )}
    </div>
    <div className="p-2 flex flex-col gap-0.5 overflow-hidden">
      <span
        className="text-xs font-medium text-gray-700 truncate"
        title={entry.name}
      >
        {entry.name}
      </span>
      <span className="text-xs text-gray-500">
        {`${new Date(entry.openedAt).toLocaleDateString()} ${new Date(entry.openedAt).toLocaleTimeString()}`}
      </span>
    </div>
  </div>
);

type DemoModel = {
  name: string;
  description: string;
  url: string;
  thumbnailUrl: string;
};

const DemoAsRecentCard = ({ demoNetwork }: { demoNetwork: DemoModel }) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const { openInpFromUrl } = useOpenInpFromUrl();

  const handleClick = () => {
    userTracking.capture({
      name: "exampleModel.clicked",
      modelName: demoNetwork.name,
    });
    void openInpFromUrl(demoNetwork.url);
  };

  return (
    <div
      className="flex flex-col rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50 overflow-hidden min-w-0"
      onClick={handleClick}
    >
      <div
        className="relative bg-gray-100 shrink-0 overflow-hidden"
        style={{ aspectRatio: "5/4" }}
      >
        <img
          src={demoNetwork.thumbnailUrl}
          alt={demoNetwork.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-2 flex flex-col gap-0.5 overflow-hidden">
        <div className="flex items-center gap-1">
          <span
            className="text-xs font-medium text-gray-700 truncate"
            title={demoNetwork.name}
          >
            {demoNetwork.name}
          </span>
          <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-orange-100 text-orange-700 rounded-full shrink-0 leading-none">
            {translate("demoShort")}
          </span>
        </div>
        <span className="text-xs text-gray-500 line-clamp-2">
          {demoNetwork.description}
        </span>
      </div>
    </div>
  );
};

const DemoNetworkCard = ({ demoNetwork }: { demoNetwork: DemoModel }) => {
  const userTracking = useUserTracking();
  const { openInpFromUrl } = useOpenInpFromUrl();

  const handleOpenDemoModel = () => {
    userTracking.capture({
      name: "exampleModel.clicked",
      modelName: demoNetwork.name,
    });
    void openInpFromUrl(demoNetwork.url);
  };
  return (
    <div
      className="flex flex-col max-w-[250px] items-center gap-x-2 bg-white shadow-md rounded-lg border cursor-pointer hover:bg-gray-400 hover:bg-opacity-10"
      onClick={handleOpenDemoModel}
    >
      <div className="flex-shrink-0">
        <Image
          src={demoNetwork.thumbnailUrl}
          alt={demoNetwork.name}
          width={247}
          height={200}
          quality={90}
          className="rounded-tl-md rounded-tr-md object-cover"
        />
      </div>
      <div className="flex flex-col p-3">
        <span className="text-gray-600 font-bold text-sm">
          {demoNetwork.name}
        </span>
        <span className="text-xs">{demoNetwork.description}</span>
      </div>
    </div>
  );
};

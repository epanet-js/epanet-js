import { useState } from "react";
import { useAuth } from "src/auth";
import { useUrlFeatureFlag } from "src/hooks/use-feature-flags";
import {
  type PrivacyPreferences,
  usePrivacySettings,
} from "src/hooks/use-privacy-settings";
import { Button, StyledSwitch, StyledThumb, styledInlineA } from "./elements";
import { privacyPolicyUrl } from "src/global-config";
import { useTranslate } from "src/hooks/use-translate";

type View = "banner" | "preferences";

export const PrivacyBanner = () => {
  const { isLoaded } = useAuth();
  const isPrivacyBannerOn = useUrlFeatureFlag("FLAG_PRIVACY_BANNER");
  const { privacySettings, setPrivacySettings } = usePrivacySettings();
  const [view, setView] = useState<View>("banner");

  if (!isLoaded || !isPrivacyBannerOn || privacySettings !== undefined) {
    return null;
  }

  const handleAcceptConsent = () => {
    void setPrivacySettings({
      skipAnalytics: false,
      skipErrorReporting: false,
    });
  };

  const handleManagePreferences = () => {
    setView("preferences");
  };

  return (
    <div className="fixed bottom-10 left-0 w-full z-50 pointer-events-none">
      <div className="max-w-4xl mx-auto px-4 pointer-events-auto">
        <div
          className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg p-6"
          data-privacy-banner
          onPointerDownCapture={(e) => {
            e.stopPropagation();
          }}
        >
          {view === "banner" ? (
            <BannerView
              onAccept={handleAcceptConsent}
              onManagePreferences={handleManagePreferences}
            />
          ) : (
            <PreferencesView
              privacySettings={privacySettings}
              setPrivacySettings={setPrivacySettings}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const BannerView = ({
  onAccept,
  onManagePreferences,
}: {
  onAccept: () => void;
  onManagePreferences: () => void;
}) => {
  const translate = useTranslate();

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
        {translate("privacyBanner.title")}
      </h2>
      <div className="text-sm text-gray-700 dark:text-gray-300 space-y-3">
        <p>{translate("privacyBanner.description")}</p>
        <p>
          {translate("privacyBanner.seePrivacyPolicy")}{" "}
          <strong>
            <a
              href={privacyPolicyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styledInlineA}
            >
              {translate("privacyPolicy")}
            </a>
          </strong>
          .
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
        <Button variant="default" onClick={onManagePreferences}>
          {translate("privacyBanner.managePreferences")}
        </Button>
        <Button variant="primary" onClick={onAccept}>
          {translate("privacyBanner.acceptAndContinue")}
        </Button>
      </div>
    </div>
  );
};

const PreferencesView = ({
  privacySettings,
  setPrivacySettings,
}: {
  privacySettings: PrivacyPreferences | undefined;
  setPrivacySettings: (settings: PrivacyPreferences) => Promise<void>;
}) => {
  const translate = useTranslate();
  const [preferences, setPreferences] = useState<PrivacyPreferences>(
    privacySettings ?? {
      skipAnalytics: true,
      skipErrorReporting: true,
    },
  );

  const handleSave = () => {
    void setPrivacySettings(preferences);
  };

  const handleAllowAll = () => {
    void setPrivacySettings({
      skipAnalytics: false,
      skipErrorReporting: false,
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
        {translate("privacyBanner.preferencesTitle")}
      </h2>
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {translate("privacyBanner.essentialDataNotice")}
        </p>
      </div>
      <div className="flex justify-start">
        <Button variant="primary" onClick={handleAllowAll}>
          {translate("privacyBanner.acceptAllPreferences")}
        </Button>
      </div>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              {translate("privacyBanner.productAnalyticsTitle")}
            </h3>
            <p
              className="text-sm text-gray-700 dark:text-gray-300"
              dangerouslySetInnerHTML={{
                __html: translate("privacyBanner.productAnalyticsDescription"),
              }}
            />
          </div>
          <div className="flex-shrink-0 pt-1">
            <StyledSwitch
              checked={!preferences.skipAnalytics}
              onCheckedChange={(checked) =>
                setPreferences((prev) => ({ ...prev, skipAnalytics: !checked }))
              }
            >
              <StyledThumb />
            </StyledSwitch>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              {translate("privacyBanner.errorReportingTitle")}
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {translate("privacyBanner.errorReportingDescription")}
            </p>
          </div>
          <div className="flex-shrink-0 pt-1">
            <StyledSwitch
              checked={!preferences.skipErrorReporting}
              onCheckedChange={(checked) =>
                setPreferences((prev) => ({
                  ...prev,
                  skipErrorReporting: !checked,
                }))
              }
            >
              <StyledThumb />
            </StyledSwitch>
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSave}>
          {translate("privacyBanner.savePreferences")}
        </Button>
      </div>
    </div>
  );
};

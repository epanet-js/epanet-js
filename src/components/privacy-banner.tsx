import { useState } from "react";
import { useAuth } from "src/auth";
import { useUrlFeatureFlag } from "src/hooks/use-feature-flags";
import {
  type PrivacyPreferences,
  usePrivacySettings,
} from "src/hooks/use-privacy-settings";
import { Button, StyledSwitch, StyledThumb, styledInlineA } from "./elements";
import { privacyPolicyUrl } from "src/global-config";

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
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
        Protecting your privacy
      </h2>
      <div className="text-sm text-gray-700 dark:text-gray-300 space-y-3">
        <p>
          We use tracking technologies to understand how the app is used and to
          improve your experience. To comply with privacy regulations, we need
          your consent to collect this data.
        </p>
        <p>
          For more details, please see our{" "}
          <strong>
            <a
              href={privacyPolicyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styledInlineA}
            >
              privacy policy
            </a>
          </strong>
          .
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
        <Button variant="default" onClick={onManagePreferences}>
          Manage my preferences
        </Button>
        <Button variant="primary" onClick={onAccept}>
          Accept and continue
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
        Manage your data preferences
      </h2>
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          To ensure the app works properly, we automatically collect anonymous
          data about page views and use feature flags to enable and manage new
          features. This information is essential for the app's basic
          functionality and cannot be disabled.
        </p>
      </div>
      <div className="flex justify-start">
        <Button variant="primary" onClick={handleAllowAll}>
          Accept all optional preferences
        </Button>
      </div>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Product analytics
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              We collect <strong>anonymous</strong> usage data to understand how
              features are used and to improve performance and functionality.
              This information does not personally identify you.
            </p>
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
              Error reporting
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              We collect crash and error reports to fix bugs and prevent issues.
              This may include details about your device and what was happening
              in the app when the error occurred.
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
          Save preferences
        </Button>
      </div>
    </div>
  );
};

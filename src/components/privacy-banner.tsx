import { useState } from "react";
import { useAuth } from "src/auth";
import { useUrlFeatureFlag } from "src/hooks/use-feature-flags";
import { useUserSettings } from "src/hooks/use-user-settings";
import { type PrivacyPreferences } from "src/state/user-settings";
import { Button, StyledSwitch, StyledThumb, styledInlineA } from "./elements";
import { privacyPolicyUrl } from "src/global-config";

type View = "banner" | "preferences";

export const PrivacyBanner = () => {
  const { isLoaded } = useAuth();
  const isPrivacyBannerOn = useUrlFeatureFlag("FLAG_PRIVACY_BANNER");
  const { privacySettings, setPrivacySettings } = useUserSettings();
  const [view, setView] = useState<View>("banner");

  if (!isLoaded || !isPrivacyBannerOn || privacySettings !== undefined) {
    return null;
  }

  const handleAcceptConsent = () => {
    void setPrivacySettings({
      analytics: true,
      errorReporting: true,
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
          <a
            href={privacyPolicyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styledInlineA}
          >
            Privacy policy
          </a>
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
      analytics: false,
      errorReporting: false,
    },
  );

  const handleSave = () => {
    void setPrivacySettings(preferences);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
        Manage your data preferences
      </h2>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        You can choose which types of data we collect to improve your
        experience.
      </p>
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 pt-1">
            <StyledSwitch
              checked={preferences.analytics}
              onCheckedChange={(checked) =>
                setPreferences((prev) => ({ ...prev, analytics: checked }))
              }
            >
              <StyledThumb />
            </StyledSwitch>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              App analytics
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              We collect <strong>anonymous</strong> usage data to understand how
              our app is used, which helps us improve its performance and
              features. This data does not personally identify you.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 pt-1">
            <StyledSwitch
              checked={preferences.errorReporting}
              onCheckedChange={(checked) =>
                setPreferences((prev) => ({
                  ...prev,
                  errorReporting: checked,
                }))
              }
            >
              <StyledThumb />
            </StyledSwitch>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Error reporting
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              We automatically collect crash and error reports to fix bugs and
              prevent issues. This data may include information about your
              device and the state of the app at the time of the error.
            </p>
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

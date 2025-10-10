import { useAtom } from "jotai";
import { useAuth } from "src/auth";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { userSettingsAtom } from "src/state/user-settings";
import { Button, styledInlineA } from "./elements";
import { privacyPolicyUrl } from "src/global-config";

export const PrivacyBanner = () => {
  const { isSignedIn, isLoaded } = useAuth();
  const isPrivacyBannerOn = useFeatureFlag("FLAG_PRIVACY_BANNER");
  const [userSettings, setUserSettings] = useAtom(userSettingsAtom);

  if (
    !isLoaded ||
    isSignedIn ||
    !isPrivacyBannerOn ||
    userSettings.gdprConsentAnonymous
  ) {
    return null;
  }

  const handleAcceptConsent = () => {
    setUserSettings((prev) => ({
      ...prev,
      gdprConsentAnonymous: true,
    }));
  };

  const handleManagePreferences = () => {
    setUserSettings((prev) => ({
      ...prev,
      gdprConsentAnonymous: true,
    }));
  };

  return (
    <div className="fixed bottom-10 left-0 w-full z-50 pointer-events-none">
      <div className="max-w-4xl mx-auto px-4 pointer-events-auto">
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg p-6">
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Protecting your privacy
            </h2>
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-3">
              <p>
                We use tracking technologies to understand how our app is used
                and to improve your experience. To comply with privacy
                regulations, we need your consent to collect this data. You can
                manage your preferences at any time in the app's settings.
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
              <Button variant="default" onClick={handleManagePreferences}>
                Manage my preferences
              </Button>
              <Button variant="primary" onClick={handleAcceptConsent}>
                Accept and continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

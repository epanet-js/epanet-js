import { useAtom, useAtomValue } from "jotai";
import {
  DialogContainer,
  DialogHeader,
  DialogButtons,
} from "src/components/dialog";
import { Button } from "../elements";
import { Checkbox } from "../form/Checkbox";
import { useTranslate } from "src/hooks/use-translate";
import { Trans } from "react-i18next";
import { useUserTracking } from "src/infra/user-tracking";
import { userSettingsAtom } from "src/state/user-settings";
import { fileInfoAtom } from "src/state/jotai";
import { AddScenarioIcon } from "src/icons";
import { EarlyAccessBadge } from "../early-access-badge";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const FirstScenarioDialog = ({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) => {
  const translate = useTranslate();
  const [userSettings, setUserSettings] = useAtom(userSettingsAtom);
  const userTracking = useUserTracking();
  const isDemoTrialOn = useFeatureFlag("FLAG_DEMO_TRIAL");
  const fileInfo = useAtomValue(fileInfoAtom);
  const showDemoTrialNote = isDemoTrialOn && fileInfo?.isDemoNetwork;

  const handleCreate = () => {
    onConfirm();
    onClose();
  };

  const handleCheckboxChange = () => {
    const newValue = !userSettings.showFirstScenarioDialog;
    setUserSettings((prev) => ({
      ...prev,
      showFirstScenarioDialog: newValue,
    }));
    userTracking.capture({
      name: newValue
        ? "firstScenario.dialogEnabled"
        : "firstScenario.dialogHidden",
    });
  };

  return (
    <DialogContainer size="sm">
      <DialogHeader
        title={translate("scenarios.firstScenario.title")}
        titleIcon={AddScenarioIcon}
        badge={<EarlyAccessBadge />}
      />

      <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
        <p>{translate("scenarios.firstScenario.earlyAccess")}</p>

        {showDemoTrialNote && (
          <p className="text-sm text-gray-500 italic">
            {translate("scenarios.firstScenario.demoTrialNote")}
          </p>
        )}

        <div>
          <p>{translate("scenarios.firstScenario.pleaseNote")}</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <Trans
                i18nKey="scenarios.firstScenario.bullet1"
                components={{ bold: <strong /> }}
              />
            </li>
            <li>
              <Trans
                i18nKey="scenarios.firstScenario.bullet2"
                components={{ bold: <strong /> }}
              />
            </li>
            <li>{translate("scenarios.firstScenario.bullet3")}</li>
          </ul>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-4">
        <Checkbox
          checked={!userSettings.showFirstScenarioDialog}
          onChange={handleCheckboxChange}
        />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {translate("scenarios.firstScenario.dontShowAgain")}
        </span>
      </div>

      <DialogButtons>
        <Button variant="primary" onClick={handleCreate}>
          {translate("scenarios.firstScenario.createButton")}
        </Button>
        <Button variant="default" onClick={onClose}>
          {translate("cancel")}
        </Button>
      </DialogButtons>
    </DialogContainer>
  );
};

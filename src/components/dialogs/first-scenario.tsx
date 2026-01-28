import { useAtom } from "jotai";
import {
  DialogContainer,
  DialogHeader,
  DialogButtons,
} from "src/components/dialog";
import { Button } from "../elements";
import { Checkbox } from "../form/Checkbox";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { userSettingsAtom } from "src/state/user-settings";
import { AddScenarioIcon } from "src/icons";
import { EarlyAccessBadge } from "../early-access-badge";

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

        <div>
          <p>{translate("scenarios.firstScenario.pleaseNote")}</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>{translate("scenarios.firstScenario.bullet1")}</li>
            <li>{translate("scenarios.firstScenario.bullet2")}</li>
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

import { useAtom } from "jotai";
import {
  DialogContainer,
  DialogHeader,
  DialogButtons,
  BaseDialog,
  SimpleDialogActionsNew,
} from "src/components/dialog";
import { Button } from "../elements";
import { Checkbox } from "../form/Checkbox";
import { useTranslate } from "src/hooks/use-translate";
import { Trans } from "react-i18next";
import { useUserTracking } from "src/infra/user-tracking";
import { userSettingsAtom } from "src/state/user-settings";
import { AddScenarioIcon } from "src/icons";
import { EarlyAccessBadge } from "../early-access-badge";

export const FirstScenarioDialog = ({
  onConfirm,
  onClose,
  isModalsOn,
}: {
  onConfirm: () => void;
  onClose: () => void;
  isModalsOn?: boolean;
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

  const content = (
    <>
      <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
        <p>{translate("scenarios.firstScenario.earlyAccess")}</p>

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
            <li>
              <Trans
                i18nKey="scenarios.firstScenario.bullet4"
                components={{ bold: <strong /> }}
              />
            </li>
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
    </>
  );

  if (isModalsOn) {
    return (
      <BaseDialog
        title={translate("scenarios.firstScenario.title")}
        size="sm"
        isOpen={true}
        onClose={onClose}
        badge={<EarlyAccessBadge />}
        footer={
          <SimpleDialogActionsNew
            action={translate("scenarios.firstScenario.createButton")}
            onAction={handleCreate}
            secondary={{
              action: translate("dialog.cancel"),
              onClick: onClose,
            }}
          />
        }
      >
        <div className="p-4 text-sm text-gray-700">{content}</div>
      </BaseDialog>
    );
  }

  return (
    <DialogContainer size="sm">
      <DialogHeader
        title={translate("scenarios.firstScenario.title")}
        titleIcon={AddScenarioIcon}
        badge={<EarlyAccessBadge />}
      />
      {content}
      <DialogButtons>
        <Button variant="primary" onClick={handleCreate}>
          {translate("scenarios.firstScenario.createButton")}
        </Button>
        <Button variant="default" onClick={onClose}>
          {translate("dialog.cancel")}
        </Button>
      </DialogButtons>
    </DialogContainer>
  );
};

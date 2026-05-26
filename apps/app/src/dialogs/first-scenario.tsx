import { useAtom } from "jotai";
import { BaseDialog, SimpleDialogActions } from "src/components/dialog";
import { Checkbox } from "../components/form/Checkbox";
import { useTranslate } from "src/hooks/use-translate";
import { Trans } from "react-i18next";
import { useUserTracking } from "src/infra/user-tracking";
import { userSettingsAtom } from "src/state/user-settings";
import { EarlyAccessBadge } from "../components/early-access-badge";

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

  return (
    <BaseDialog
      title={translate("scenarios.firstScenario.title")}
      size="md"
      isOpen={true}
      onClose={onClose}
      badge={<EarlyAccessBadge />}
      footer={
        <SimpleDialogActions
          action={translate("scenarios.firstScenario.createButton")}
          onAction={handleCreate}
          secondary={{
            action: translate("dialog.cancel"),
            onClick: onClose,
          }}
        />
      }
    >
      <div className="p-4">{content}</div>
    </BaseDialog>
  );
};
